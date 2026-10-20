# Optional local teaching build only. For reproducible deployment, pin an approved digest.
FROM python:3.11-slim
WORKDIR /app
COPY service.py /app/service.py
USER 10001
ENV APP_HOST=0.0.0.0 APP_PORT=8765
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/live', timeout=2)"
CMD ["python", "service.py"]
