"""CloudWatch alarms for the MDM API (backend-for-frontend).

Returns the platform alarms (defined in monitoring.yml, prefixed with the
project name) as JSON so the dashboard can render live alarm posture and derive
pipeline node status signals.

Endpoint (routed by app.handler):
  GET /alarms -> {"alarms": [ {name, state, metric, namespace, threshold,
                               reason, updatedAt}, ... ]}
"""
from __future__ import annotations

import os

PROJECT = os.environ.get("PROJECT_NAME", "dataforge")

_CLIENT = None


def _client():
    global _CLIENT
    if _CLIENT is None:
        import boto3

        _CLIENT = boto3.client("cloudwatch")
    return _CLIENT


def _fmt(ts):
    try:
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    except AttributeError:
        return str(ts) if ts else ""


def list_alarms(prefix=None):
    prefix = prefix or PROJECT
    client = _client()
    alarms = []
    paginator = client.get_paginator("describe_alarms")
    for page in paginator.paginate(AlarmNamePrefix=prefix, AlarmTypes=["MetricAlarm"]):
        for a in page.get("MetricAlarms", []):
            alarms.append({
                "name": a.get("AlarmName"),
                "state": a.get("StateValue", "INSUFFICIENT_DATA"),
                "metric": a.get("MetricName", ""),
                "namespace": a.get("Namespace", ""),
                "threshold": a.get("Threshold"),
                "reason": a.get("StateReason", ""),
                "updatedAt": _fmt(a.get("StateUpdatedTimestamp")),
            })
    return alarms
