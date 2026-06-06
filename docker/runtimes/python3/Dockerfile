FROM python:3.12-slim
WORKDIR /actor
COPY sdk/myapify.py /usr/local/lib/python3.12/site-packages/myapify.py
RUN pip install requests
CMD ["python3", "main.py"]
