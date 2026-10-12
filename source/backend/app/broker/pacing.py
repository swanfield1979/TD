import asyncio
import time
from collections import deque


class Pacer:
    """One queue for contract/history/retry requests; rolling cap plus minimum interval."""

    def __init__(
        self, interval, limit, window, clock=time.monotonic, sleep=asyncio.sleep
    ):
        self.interval, self.limit, self.window = interval, limit, window
        self.clock, self.sleep = clock, sleep
        self.requests = deque()
        self.last = None
        self.identical = {}
        self.lock = asyncio.Lock()

    async def wait(self, key=None):
        async with self.lock:
            now = self.clock()
            while self.requests and now - self.requests[0] >= self.window:
                self.requests.popleft()
            wait = (
                max(0, self.interval - (now - self.last))
                if self.last is not None
                else 0
            )
            if len(self.requests) >= self.limit:
                wait = max(wait, self.requests[0] + self.window - now)
            if key is not None and key in self.identical:
                wait = max(wait, 15 - (now - self.identical[key]))
            if wait:
                await self.sleep(wait)
            now = self.clock()
            while self.requests and now - self.requests[0] >= self.window:
                self.requests.popleft()
            self.requests.append(now)
            self.last = now
            if key is not None:
                self.identical[key] = now
