import os
import base64
import boto3
from dotenv import load_dotenv

load_dotenv()


def _get_polly_client():
    return boto3.client(
        "polly",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def text_to_speech_base64(text: str) -> str:
    """Convert text to speech using AWS Polly and return base64-encoded MP3."""
    try:
        polly = _get_polly_client()
        response = polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId="Joanna",
            Engine="neural",
        )
        audio_bytes = response["AudioStream"].read()
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        print(f"Polly TTS error: {e}")
        return ""
