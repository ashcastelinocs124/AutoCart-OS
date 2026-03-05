from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
api = FastAPI()

class TaskRequest(BaseModel):
    agreementHash: str
    task: str

@api.post("/execute")
def execute(req: TaskRequest):
    resp = llm.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a summarization agent. Summarize the given text concisely."},
            {"role": "user", "content": req.task}
        ]
    )
    return {
        "agreementHash": req.agreementHash,
        "output": resp.choices[0].message.content,
        "agent": "SummarizeBot"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8001)
