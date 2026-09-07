#!/usr/bin/env python3
"""
Batch image tagging via OpenRouter Vision API.
Reads all images from a directory, sends them in one API call,
and outputs a JSON file with descriptions and KEEP/DELETE tags.

Usage:
    python vision_tag_images.py --dir ./images [--model google/gemini-2.0-flash-001]
"""

import os
import sys
import json
import base64
import argparse
import mimetypes
from pathlib import Path
from typing import Optional

API_URL = "https://openrouter.ai/api/v1/chat/completions"


def get_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        print("ERROR: OPENROUTER_API_KEY environment variable not set")
        sys.exit(1)
    return key


def encode_image(path: Path) -> tuple[str, str]:
    """Return (mime_type, base64_data) for an image."""
    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        # Fallback based on extension
        ext = path.suffix.lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp", "bmp": "image/bmp"}.get(ext, "image/png")
    data = base64.b64encode(path.read_bytes()).decode("utf-8")
    return mime, data


def build_prompt(image_files: list[Path]) -> list[dict]:
    """Build the messages payload with all images."""
    content_parts = [
        {"type": "text", "text": """\
You are given multiple images extracted from a course PPT. For each image, determine:
1. A brief description (what the image shows)
2. Whether it should be KEPT or DELETED when converting the PPT to study notes
3. The reason for your decision

Rules for KEEP:
- Architecture diagrams, flowcharts, schematics, data tables, charts
- Key visualizations that help understand the course content
- Formula renderings (if they are important content)

Rules for DELETE:
- Logos, decorative images, banners, emojis
- Repeated/duplicate images
- Page headers, footers, page numbers as images
- Blurry, garbled, or unreadable images

Return a JSON array where each element has: "filename", "description", "tag" (KEEP or DELETE), "reason".
The order must match the images as listed below.
"""}
    ]

    for f in image_files:
        mime, b64 = encode_image(f)
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"}
        })
        # Add a small text label after each image for reference
        content_parts.append({
            "type": "text",
            "text": f"Above: {f.name}"
        })

    return [{"role": "user", "content": content_parts}]


def call_api(api_key: str, model: str, messages: list[dict], image_count: int) -> str:
    """Call OpenRouter API and return the response text."""
    import urllib.request
    import urllib.error

    payload = {
        "model": model,
        "messages": messages,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "image_tags",
                "strict": True,
                "schema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "filename": {"type": "string"},
                            "description": {"type": "string"},
                            "tag": {"type": "string", "enum": ["KEEP", "DELETE"]},
                            "reason": {"type": "string"}
                        },
                        "required": ["filename", "description", "tag", "reason"]
                    }
                }
            }
        },
        "max_tokens": min(4096, image_count * 200 + 500)
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/ppt2note",
            "X-Title": "ppt2note-vision-tagger"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {body}")
        sys.exit(1)
    except Exception as e:
        print(f"API call failed: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Batch image tagging via OpenRouter Vision API")
    parser.add_argument("--dir", required=True, help="Directory containing images")
    parser.add_argument("--model", default="google/gemma-4-31b-it:free",
                        help="OpenRouter vision model (default: google/gemma-4-31b-it:free)")
    parser.add_argument("--output", default="image_tags.json",
                        help="Output JSON file (default: image_tags.json)")
    parser.add_argument("--extensions", default="png,jpg,jpeg,webp,bmp,gif",
                        help="Comma-separated image extensions to process")
    args = parser.parse_args()

    img_dir = Path(args.dir)
    if not img_dir.is_dir():
        print(f"ERROR: {img_dir} is not a directory")
        sys.exit(1)

    exts = set("." + e.strip().lower().lstrip(".") for e in args.extensions.split(","))
    image_files = sorted(f for f in img_dir.iterdir() if f.suffix.lower() in exts)

    if not image_files:
        print(f"No images found in {img_dir}")
        sys.exit(0)

    print(f"Found {len(image_files)} images, sending to {args.model}...")

    api_key = get_api_key()
    messages = build_prompt(image_files)
    response_text = call_api(api_key, args.model, messages, len(image_files))

    # Parse and validate
    try:
        tags = json.loads(response_text)
    except json.JSONDecodeError:
        print("WARNING: Response is not valid JSON, saving raw text")
        Path(args.output).write_text(response_text, encoding="utf-8")
        sys.exit(0)

    # Ensure it's a list
    if not isinstance(tags, list):
        print("ERROR: Expected a JSON array in response")
        print(f"Got: {response_text[:500]}")
        sys.exit(1)

    # Save
    output_path = Path(args.output)
    output_path.write_text(json.dumps(tags, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(tags)} image tags to {output_path}")

    # Summary
    keep = sum(1 for t in tags if t.get("tag") == "KEEP")
    delete = sum(1 for t in tags if t.get("tag") == "DELETE")
    print(f"Summary: KEEP={keep}, DELETE={delete}")


if __name__ == "__main__":
    main()
