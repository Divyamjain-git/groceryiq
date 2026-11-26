"""
Thin wrapper around a locally-running Ollama instance. No external API
calls — this only ever talks to OLLAMA_HOST, which should be the ollama
container/service on your own network.
"""
import os
import requests

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


def ask_local_llm(prompt: str) -> str:
    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["response"]


def build_rag_prompt(question: str, retrieved_data: str) -> str:
    # Keep the model grounded: it only narrates the data you hand it,
    # never invents numbers of its own.
    return (
        "You are a helpful assistant for a grocery store manager. "
        "Answer the question using ONLY the data below. If the data "
        "doesn't contain the answer, say so.\n\n"
        f"DATA:\n{retrieved_data}\n\n"
        f"QUESTION: {question}\n\nANSWER:"
    )
