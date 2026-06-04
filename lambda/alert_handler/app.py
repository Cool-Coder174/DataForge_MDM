"""alert_handler Lambda - formats pipeline/DQ alerts into readable messages.

Invoked two ways:
  1. By Step Functions (action='notify') with a status payload -> publishes a
     formatted message to the SNS alert topic.
  2. By SNS subscription (when alarms fire) -> logs/echoes an enriched message.
"""
import json
import os

import boto3

sns = boto3.client("sns")
ALERT_TOPIC_ARN = os.environ.get("ALERT_TOPIC_ARN", "")
PROJECT = os.environ.get("PROJECT_NAME", "dataforge")
VERSION = "v1.0"  # demo: bump this in the CI/CD "deployment in action" step


def _format(status, payload):
    icon = "[OK]" if status == "SUCCEEDED" else "[ALERT]"
    lines = [
        f"{icon} DataForge pipeline: {status}",
        f"project: {PROJECT}",
        f"run_id: {payload.get('run_id', 'n/a')}",
    ]
    if "quality_score" in payload:
        lines.append(f"quality_score: {payload['quality_score']}")
    if "rejected_rows" in payload:
        lines.append(f"rejected_rows: {payload['rejected_rows']}")
    if "error" in payload:
        lines.append(f"error: {payload['error']}")
    lines.append(f"-- DataForge alert_handler {VERSION}")
    return "\n".join(lines)


def handler(event, _context):
    # Case 2: triggered by SNS (CloudWatch alarm) -> just enrich + log.
    if isinstance(event, dict) and "Records" in event:
        for rec in event["Records"]:
            msg = rec.get("Sns", {}).get("Message", "")
            print(f"[alert_handler] SNS alarm received: {msg}")
        return {"handled": len(event["Records"])}

    # Case 1: invoked by Step Functions to publish a notification.
    status = event.get("status", "SUCCEEDED")
    payload = event.get("payload", event)
    message = _format(status, payload)
    subject = f"DataForge {status}"[:100]

    if ALERT_TOPIC_ARN:
        sns.publish(TopicArn=ALERT_TOPIC_ARN, Subject=subject, Message=message)
        print(f"[alert_handler] published to {ALERT_TOPIC_ARN}")
    else:
        print(f"[alert_handler] no topic configured; message:\n{message}")

    return {"published": bool(ALERT_TOPIC_ARN), "message": message}
