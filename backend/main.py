"""
Quartermaster System - Main Application
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.router import api_router
from app.config import settings
from lifetime_function import lifespan_callback

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Quartermaster System",
    version=settings.APP_VERSION,
    lifespan=lifespan_callback,
    openapi_url="/hema-crm/api/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)


class RootSchema(BaseModel):
    """Root schema"""
    message: str
    version: str
    docs: str
    api: str


@app.get("/")
async def root() -> RootSchema:
    """Root endpoint"""
    return RootSchema(
        message=f"Welcome to {settings.APP_NAME}",
        version=settings.APP_VERSION,
        docs="/docs",
        api=settings.API_PREFIX
    )


class HealthSchema(BaseModel):
    """Health schema"""
    status: str
    service: str
    version: str


@app.get("/health")
async def health_check() -> HealthSchema:
    """Health check endpoint"""
    return HealthSchema(
        status="healthy",
        service=settings.APP_NAME,
        version=settings.APP_VERSION
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
