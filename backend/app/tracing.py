from __future__ import annotations

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor

from app.config import settings


def setup_tracing() -> None:
    resource = Resource.create({"service.name": settings.otel_service_name})
    provider = TracerProvider(resource=resource)

    # Always export to console (free/local). This makes debugging easy in dev.
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

    # Optional OTLP exporter (e.g., Jaeger/Tempo via OTLP HTTP)
    if settings.otel_exporter_otlp_endpoint:
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
        )

    trace.set_tracer_provider(provider)
