"""
Amazon Bedrock Knowledge Base service for RavenLens.

Provides:
  - retrieve_and_generate()  →  RAG query with multi-turn session support
  - trigger_ingestion()      →  Re-sync S3 data source after file upload
"""

import os
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("ravenlens.bedrock")

# ── Config ────────────────────────────────────────────────

BEDROCK_KB_ID          = os.getenv("BEDROCK_KB_ID", "")
BEDROCK_DATASOURCE_ID  = os.getenv("BEDROCK_DATASOURCE_ID", "")
BEDROCK_REGION         = os.getenv("BEDROCK_REGION", "us-west-2")
BEDROCK_MODEL_ARN      = os.getenv("BEDROCK_MODEL_ARN", "")


def _get_agent_runtime_client():
    """Client for querying Knowledge Bases (retrieve_and_generate)."""
    return boto3.client("bedrock-agent-runtime", region_name=BEDROCK_REGION)


def _get_agent_client():
    """Client for managing Knowledge Bases (ingestion jobs)."""
    return boto3.client("bedrock-agent", region_name=BEDROCK_REGION)


# ── RAG Query ─────────────────────────────────────────────

def retrieve_and_generate(
    question:   str,
    kb_id:      Optional[str] = None,
    session_id: Optional[str] = None,
    project_id: Optional[str] = None,
) -> dict:
    """
    RAG query against the Bedrock Knowledge Base.

    Args:
        question:   The user's question.
        kb_id:      Override KB ID (defaults to env var).
        session_id: Bedrock session ID for multi-turn context.
                    Omit on first message — Bedrock will create one.

    Returns:
        {
            "answer":     str,
            "session_id": str,        # reuse for follow-up messages
            "citations":  list[dict]  # source references
        }
    """
    kb = kb_id or BEDROCK_KB_ID
    if not kb:
        raise RuntimeError("BEDROCK_KB_ID is not configured")

    model_arn = BEDROCK_MODEL_ARN
    if not model_arn:
        raise RuntimeError(
            "BEDROCK_MODEL_ARN is not configured. "
            "Set it in .env to an active model ARN from your Bedrock console, e.g.: "
            "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0"
        )

    client = _get_agent_runtime_client()

    kb_config: dict = {
        "knowledgeBaseId": kb,
        "modelArn": model_arn,
    }

    if project_id:
        kb_config["retrievalConfiguration"] = {
            "vectorSearchConfiguration": {
                "filter": {
                    "equals": {
                        "key":   "project_id",
                        "value": project_id,
                    }
                }
            }
        }

    params = {
        "input": {"text": question},
        "retrieveAndGenerateConfiguration": {
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": kb_config,
        },
    }

    # Pass session ID for multi-turn conversations
    if session_id:
        params["sessionId"] = session_id

    try:
        response = client.retrieve_and_generate(**params)

        # Extract citations into a clean format
        raw_citations = response.get("citations", [])
        citations = []
        for cite in raw_citations:
            for ref in cite.get("retrievedReferences", []):
                loc = ref.get("location", {})
                s3_loc = loc.get("s3Location", {})
                citations.append({
                    "uri":     s3_loc.get("uri", ""),
                    "content": ref.get("content", {}).get("text", "")[:200],
                })

        result = {
            "answer":     response["output"]["text"],
            "session_id": response.get("sessionId", ""),
            "citations":  citations,
        }

        logger.info("Bedrock RAG query OK — session=%s, citations=%d",
                     result["session_id"], len(citations))
        return result

    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        # Session expired — retry without session_id
        if error_code in ("ValidationException", "ResourceNotFoundException"):
            if session_id:
                logger.warning("Bedrock session expired (%s), retrying without session",
                               session_id)
                return retrieve_and_generate(question, kb_id=kb, session_id=None, project_id=project_id)
        logger.exception("Bedrock retrieve_and_generate failed")
        raise


# ── Ingestion ─────────────────────────────────────────────

def trigger_ingestion(
    kb_id:         Optional[str] = None,
    datasource_id: Optional[str] = None,
) -> str:
    """
    Trigger a data source re-sync after a new file is uploaded to S3.

    Returns the ingestion job ID, or empty string if not configured.
    """
    kb = kb_id or BEDROCK_KB_ID
    ds = datasource_id or BEDROCK_DATASOURCE_ID

    if not kb or not ds:
        logger.warning("Bedrock KB/datasource not configured — skipping ingestion")
        return ""

    client = _get_agent_client()

    try:
        response = client.start_ingestion_job(
            knowledgeBaseId=kb,
            dataSourceId=ds,
        )
        job_id = response["ingestionJob"]["ingestionJobId"]
        logger.info("Bedrock ingestion started — job=%s, kb=%s", job_id, kb)
        return job_id

    except ClientError as exc:
        logger.exception("Bedrock ingestion trigger failed: %s", exc)
        raise
