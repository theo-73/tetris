from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
try:
    from engine import GameEngine
except ImportError:
    from backend.engine import GameEngine
import json
import asyncio
import random
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tetris-backend")

app = FastAPI(title="Entropic Tetris Backend")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Entropic Tetris Backend Active", "status": "operational"}

@app.get("/healthz")
async def health():
    return {"status": "ok", "service": "entropic-tetris-backend"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    engine = GameEngine()
    active_tasks = set()
    
    # State synchronization
    lock_id = 0
    last_active_pos = {"x": 4, "y": 0}

    async def shadow_agent_loop():
        nonlocal lock_id
        try:
            while True:
                await asyncio.sleep(8)
                
                # Check if cell is already locked
                if engine.locked_cell is not None:
                    continue

                # Target a cell near where the player last navigated
                target_y = min(19, max(0, last_active_pos["y"] + random.randint(1, 3)))
                target_x = min(9, max(0, last_active_pos["x"] + random.randint(-1, 1)))
                
                if engine.grid[target_y][target_x] == 0:
                    lock_id += 1
                    current_cid = lock_id
                    cell_data = {"x": target_x, "y": target_y}
                    engine.locked_cell = cell_data
                    
                    await websocket.send_json({
                        "type": "CELL_LOCK",
                        "payload": cell_data
                    })
                    
                    await asyncio.sleep(4.0)
                    if lock_id == current_cid:
                        engine.clear_lock()
                        await websocket.send_json({"type": "CLEAR_LOCK"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Shadow Agent error: {e}")

    # Launch shadow agent
    shadow_task = asyncio.create_task(shadow_agent_loop())
    active_tasks.add(shadow_task)
    shadow_task.add_done_callback(active_tasks.discard)

    try:
        # Send initial piece update on connection
        initial_piece = engine.get_next_piece()
        await websocket.send_json({
            "type": "ADVERSARIAL_UPDATE",
            "payload": initial_piece
        })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "BOARD_STATE":
                board = message.get("payload", [])
                engine.update_board(board)
                adversarial_data = engine.get_next_piece()
                await websocket.send_json({
                    "type": "ADVERSARIAL_UPDATE",
                    "payload": adversarial_data
                })

            elif msg_type == "PURGE_EVENT":
                lock_id += 1  # Invalidate pending clears
                engine.clear_lock()
                await websocket.send_json({"type": "CLEAR_LOCK"})

            elif msg_type == "RESET_GAME":
                lock_id += 1
                engine.reset()
                fresh_piece = engine.get_next_piece()
                await websocket.send_json({"type": "RESET_ACK"})
                await websocket.send_json({
                    "type": "ADVERSARIAL_UPDATE",
                    "payload": fresh_piece
                })

            elif msg_type == "LIVE_UPDATE":
                active_piece = message.get("payload", {})
                raw_x = active_piece.get("x", 4)
                raw_y = active_piece.get("y", 0)
                
                last_active_pos["x"] = max(0, min(9, int(raw_x)))
                last_active_pos["y"] = max(0, min(19, int(raw_y)))
                
                # Predictive targeting when piece is deeper in the well
                if last_active_pos["y"] > 8 and engine.locked_cell is None:
                    if (hash(str(active_piece)) % 100) < 14:
                        tx = max(0, min(9, last_active_pos["x"]))
                        ty = max(0, min(19, last_active_pos["y"] + 2))
                        
                        if engine.grid[ty][tx] == 0:
                            lock_id += 1
                            current_cid = lock_id
                            engine.locked_cell = {"x": tx, "y": ty}
                            
                            await websocket.send_json({
                                "type": "CELL_LOCK",
                                "payload": engine.locked_cell
                            })
                            
                            async def delayed_clear(cid):
                                try:
                                    await asyncio.sleep(2.5)
                                    if lock_id == cid:
                                        engine.clear_lock()
                                        await websocket.send_json({"type": "CLEAR_LOCK"})
                                except asyncio.CancelledError:
                                    pass
                                except Exception as err:
                                    logger.error(f"Delayed clear error: {err}")
                            
                            task = asyncio.create_task(delayed_clear(current_cid))
                            active_tasks.add(task)
                            task.add_done_callback(active_tasks.discard)

    except WebSocketDisconnect:
        logger.info("Client disconnected normally.")
    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
    finally:
        # Guarantee cancellation of all associated background tasks
        for task in list(active_tasks):
            if not task.done():
                task.cancel()
        if active_tasks:
            await asyncio.gather(*active_tasks, return_exceptions=True)
        active_tasks.clear()

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
