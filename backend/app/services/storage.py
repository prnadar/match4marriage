"""
Media storage helpers.
Cloudinary is the primary provider for photo uploads.
Legacy S3 helpers remain available for voice/video migration paths if needed later.
"""
from __future__ import annotations

import time
import uuid

import cloudinary
import cloudinary.api
import cloudinary.uploader
# boto3/S3 removed for Vercel launch — Cloudinary is the primary path.
boto3 = None  # type: ignore[assignment]
class ClientError(Exception):  # type: ignore[no-redef]
    pass

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4"}

MAX_PHOTO_SIZE_MB = 10
MAX_VIDEO_SIZE_MB = 100
MAX_AUDIO_SIZE_MB = 5


_cloudinary_configured = False


def _configure_cloudinary() -> None:
    global _cloudinary_configured
    if _cloudinary_configured:
        return

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise RuntimeError("Cloudinary is not configured")

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _cloudinary_configured = True


def generate_photo_upload_signature(
    tenant_slug: str,
    user_id: str,
    file_extension: str,
) -> dict[str, str | int]:
    """
    Generate signed upload parameters for direct client -> Cloudinary photo upload.
    Returns the data the client needs to POST multipart/form-data to Cloudinary.

    Cloudinary's signature covers every custom parameter present in the
    upload request (excluding `file`, `api_key`, `signature`, `resource_type`,
    and `cloud_name`). Anything you sign here MUST appear in the client's
    form POST — and nothing extra.
    """
    _configure_cloudinary()

    timestamp = int(time.time())
    file_id = uuid.uuid4().hex
    # Cloudinary's `public_id` must NOT include the folder path when `folder`
    # is also passed — Cloudinary concatenates them itself. Bug if you send
    # both "folder=foo/bar" and "public_id=foo/bar/id": signature mismatch
    # plus a duplicated folder in the stored path.
    folder = f"{settings.CLOUDINARY_UPLOAD_FOLDER}/{tenant_slug}/{user_id}/photos"
    public_id = file_id  # just the filename portion; Cloudinary prepends folder/
    full_public_id = f"{folder}/{public_id}"

    # Sign ONLY the fields the client will POST. Order doesn't matter;
    # cloudinary.utils.api_sign_request sorts alphabetically internally.
    params_to_sign = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp,
    }
    signature = cloudinary.utils.api_sign_request(
        params_to_sign, settings.CLOUDINARY_API_SECRET
    )
    secure_url = cloudinary.CloudinaryImage(full_public_id).build_url(
        secure=True, format=file_extension
    )

    return {
        "upload_url": f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload",
        "api_key": settings.CLOUDINARY_API_KEY,
        "timestamp": timestamp,
        "signature": signature,
        "folder": folder,
        "public_id": public_id,       # short id — client must send this verbatim
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "resource_type": "image",
        "url": secure_url,
        "key": full_public_id,        # stored on our Profile row for later deletion
    }


def delete_photo(key: str) -> None:
    _configure_cloudinary()
    try:
        cloudinary.uploader.destroy(key, resource_type="image", invalidate=True)
        logger.info("cloudinary_photo_deleted", key=key)
    except Exception as exc:
        logger.error("cloudinary_delete_failed", error=str(exc), key=key)
        raise RuntimeError("Could not delete photo") from exc


# Legacy S3 helpers kept for non-photo flows during migration.
def _s3_client():
    raise RuntimeError("S3 disabled at launch — use Cloudinary helpers above")


def generate_upload_url(
    tenant_slug: str,
    user_id: str,
    media_type: str,
    content_type: str,
    file_extension: str,
) -> dict[str, str]:
    file_id = uuid.uuid4().hex
    s3_key = f"{tenant_slug}/{user_id}/{media_type}/{file_id}.{file_extension}"

    try:
        s3 = _s3_client()
        url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.AWS_S3_BUCKET,
                "Key": s3_key,
                "ContentType": content_type,
            },
            ExpiresIn=600,
        )
    except ClientError as exc:
        logger.error("s3_presign_failed", error=str(exc), key=s3_key)
        raise RuntimeError("Could not generate upload URL") from exc

    cdn_url = f"{settings.media_base_url}/{s3_key}"
    return {"upload_url": url, "s3_key": s3_key, "cdn_url": cdn_url}


def delete_media(s3_key: str) -> None:
    try:
        s3 = _s3_client()
        s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
        logger.info("media_deleted", key=s3_key)
    except ClientError as exc:
        logger.error("s3_delete_failed", error=str(exc), key=s3_key)
