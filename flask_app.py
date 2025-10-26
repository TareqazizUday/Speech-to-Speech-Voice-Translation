from flask import Flask, render_template, request, jsonify, send_file, session
import librosa
import soundfile as sf
import os
import numpy as np
from werkzeug.utils import secure_filename
import warnings
import uuid
warnings.filterwarnings('ignore')

try:
    from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToSpeech
except ImportError:
    from transformers.models.auto.processing_auto import AutoProcessor
    from transformers import SeamlessM4Tv2ForSpeechToSpeech

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs('static', exist_ok=True)

SUPPORTED_LANGUAGES = {
    "Bengali": "ben",
    "English": "eng",
    "Chinese": "cmn",
    "Spanish": "spa",
    "German": "deu",
    "Arabic": "arb",
    "Japanese": "jpn",
    "Korean": "kor",
    "Portuguese": "por",
    "French": "fra",
    "Italian": "ita",
    "Russian": "rus",
}

SAMPLING_RATE = 16000

processor = None
model = None

def load_models():
    """Load the SeamlessM4T model and processor"""
    global processor, model
    
    if processor is None or model is None:
        print("Loading models... This may take a while on first run.")
        try:
            processor = AutoProcessor.from_pretrained(
                "facebook/seamless-m4t-v2-large",
                trust_remote_code=True,
                local_files_only=False
            )
            model = SeamlessM4Tv2ForSpeechToSpeech.from_pretrained(
                "facebook/seamless-m4t-v2-large",
                trust_remote_code=True,
                local_files_only=False
            )
            print("Models loaded successfully!")
        except ValueError as e:
            if "SentencePiece" in str(e):
                print("Using slow tokenizer due to SentencePiece conversion issue...")
                processor = AutoProcessor.from_pretrained(
                    "facebook/seamless-m4t-v2-large",
                    trust_remote_code=True,
                    use_fast=False
                )
                model = SeamlessM4Tv2ForSpeechToSpeech.from_pretrained(
                    "facebook/seamless-m4t-v2-large",
                    trust_remote_code=True
                )
            else:
                raise
    
    return processor, model

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html', languages=SUPPORTED_LANGUAGES)

@app.route('/upload', methods=['POST'])
def upload_audio():
    """Handle audio file upload (including recorded audio)"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        file_id = str(uuid.uuid4())

        if file.filename.endswith('.mp3'):
            filename = secure_filename(f"{file_id}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            print(f"MP3 file uploaded: {filename}, size: {os.path.getsize(filepath)} bytes")

        elif file.filename.endswith('.wav'):
            temp_filename = f"{file_id}_temp.wav"
            temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)

            file.save(temp_filepath)
            print(f"WAV file saved: {temp_filename}, size: {os.path.getsize(temp_filepath)} bytes")

            try:
                audio_data, sr = librosa.load(temp_filepath, sr=16000, mono=True)
                print(f"Audio loaded: shape={audio_data.shape}, sr={sr}")

                filename = f"{file_id}_recorded.mp3"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                sf.write(filepath, audio_data, sr, format='WAV', subtype='PCM_16')

                print(f"Converted to MP3: {filename}, size: {os.path.getsize(filepath)} bytes")

                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)

            except Exception as e:
                print(f"WAV conversion error: {str(e)}")
                import traceback
                traceback.print_exc()

                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)

                return jsonify({'error': f'Failed to convert WAV: {str(e)}'}), 400
        else:
            return jsonify({'error': 'Unsupported file format. Please upload MP3 or WAV files.'}), 400

        print(f"Final file: {filename}, size: {os.path.getsize(filepath)} bytes")

        session['audio_file'] = filename
        session['file_id'] = file_id

        return jsonify({
            'success': True,
            'message': 'Audio uploaded successfully',
            'file_id': file_id,
            'filename': filename
        })

    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/translate', methods=['POST'])
def translate_audio():
    """Translate audio to target language"""
    try:
        data = request.get_json()
        target_language = data.get('target_language')

        if not target_language or target_language not in SUPPORTED_LANGUAGES.values():
            return jsonify({'error': 'Invalid target language'}), 400

        if 'audio_file' not in session:
            return jsonify({'error': 'No audio file uploaded'}), 400

        audio_path = os.path.join(app.config['UPLOAD_FOLDER'], session['audio_file'])
        if not os.path.exists(audio_path):
            return jsonify({'error': 'Audio file not found'}), 404

        print(f"Loading audio from: {audio_path}")

        try:
            audio_array, sr = librosa.load(audio_path, sr=SAMPLING_RATE, mono=True)
            print(f"Audio loaded: shape={audio_array.shape}, sr={sr}")
        except Exception as e:
            print(f"Error loading audio with librosa: {e}")
            return jsonify({'error': f'Failed to load audio file: {str(e)}'}), 400

        if len(audio_array) == 0:
            return jsonify({'error': 'Audio file is empty or invalid'}), 400

        proc, mdl = load_models()

        print("Processing audio...")
        audio_inputs = proc(audios=audio_array, return_tensors="pt")

        print(f"Generating translation to {target_language}...")
        output = mdl.generate(**audio_inputs, tgt_lang=target_language)[0]
        translated_audio = output.cpu().numpy().squeeze()

        print("Saving translated audio...")
        output_filename = f"translated_{session['file_id']}_{target_language}.wav"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        sf.write(output_path, translated_audio, samplerate=SAMPLING_RATE)

        print(f"Translation complete: {output_filename}")

        return jsonify({
            'success': True,
            'message': 'Translation completed successfully',
            'output_file': output_filename
        })

    except Exception as e:
        print(f"Translation error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Download translated audio file"""
    try:
        filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(filepath, as_attachment=True)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/play/<filename>')
def play_file(filename):
    """Stream audio file for playback"""
    try:
        filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(filepath, mimetype='audio/wav')
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Speech to Speech Voice Translation Application...")
    load_models()

    app.run(debug=True, host='127.0.0.1', port=5001, use_reloader=False)

