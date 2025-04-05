FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY client/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only necessary files
COPY client.py .
COPY ip_addresses.csv .

CMD ["python", "client.py"]