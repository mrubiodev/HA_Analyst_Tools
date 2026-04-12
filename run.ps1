# Build and run the hass service as a Docker container
$IMAGE_NAME = "hass"
$CONTAINER_NAME = "hass"
$PORT = 8080

# Stop and remove existing container if running
$existing = docker ps -aq --filter "name=$CONTAINER_NAME"
if ($existing) {
    Write-Host "Stopping existing container..."
    docker stop $CONTAINER_NAME | Out-Null
    docker rm $CONTAINER_NAME | Out-Null
}

# Build the image
Write-Host "Building Docker image..."
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed."
    exit 1
}

# Run the container
Write-Host "Starting container on http://localhost:$PORT ..."
docker run -d --name $CONTAINER_NAME -p "${PORT}:80" $IMAGE_NAME

Write-Host "Service running at http://localhost:$PORT"
