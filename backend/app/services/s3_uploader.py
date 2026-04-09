"""
S3 upload service for RavenLens knowledge files.

On approval, files are uploaded to:
    s3://<bucket>/<project_id>/<file_id>_<filename>
"""

import os
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("ravenlens.s3")

# ── Config ────────────────────────────────────────────────

AWS_S3_BUCKET    = os.getenv("AWS_S3_BUCKET_NAME", "")
AWS_REGION       = os.getenv("AWS_REGION", "us-west-2")
AWS_ACCESS_KEY   = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY   = os.getenv("AWS_SECRET_ACCESS_KEY", "")


def _get_s3_client():
    """Build and return a boto3 S3 client."""
    kwargs = {"region_name": AWS_REGION}
    if AWS_ACCESS_KEY and AWS_SECRET_KEY:
        kwargs["aws_access_key_id"]     = AWS_ACCESS_KEY
        kwargs["aws_secret_access_key"] = AWS_SECRET_KEY
    return boto3.client("s3", **kwargs)


def upload_file_to_s3(
    file_data:  bytes,
    filename:   str,
    project_id: str,
    file_id:    str,
    mime_type:  Optional[str] = None,
) -> str:
    """
    Upload raw file bytes to S3 under the project's GUID folder.

    Returns the S3 object key on success, or raises on failure.
    Key format: {project_id}/{file_id}_{filename}
    """
    if not AWS_S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET_NAME is not configured")

    s3_key = f"{project_id}/{file_id}_{filename}"

    extra_args = {}
    if mime_type:
        extra_args["ContentType"] = mime_type

    client = _get_s3_client()

    try:
        client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=file_data,
            **extra_args,
        )
        logger.info("Uploaded %s to s3://%s/%s", filename, AWS_S3_BUCKET, s3_key)
        return s3_key

    except ClientError as exc:
        logger.error("S3 upload failed for %s: %s", s3_key, exc)
        raise
