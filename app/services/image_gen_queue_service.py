import threading
import queue
import uuid


class ImageGenTask:
    def __init__(self, func, args, kwargs):
        self.id = uuid.uuid4().hex
        self.func = func
        self.args = args
        self.kwargs = kwargs
        self._event = threading.Event()
        self._result = None
        self._error = None

    def set_result(self, result):
        self._result = result
        self._event.set()

    def set_error(self, error):
        self._error = error
        self._event.set()

    def wait(self, timeout=None):
        self._event.wait(timeout)
        if self._error:
            raise self._error
        return self._result


class ImageGenQueueService:
    def __init__(self):
        self._queue = queue.Queue()
        self._worker = None
        self._lock = threading.Lock()

    def _ensure_worker(self):
        with self._lock:
            if self._worker and self._worker.is_alive():
                return
            self._worker = threading.Thread(target=self._run, daemon=True)
            self._worker.start()

    def _run(self):
        while True:
            task = self._queue.get()
            try:
                result = task.func(*task.args, **task.kwargs)
                task.set_result(result)
            except Exception as e:
                task.set_error(e)
            finally:
                self._queue.task_done()

    def submit(self, func, *args, **kwargs):
        self._ensure_worker()
        task = ImageGenTask(func, args, kwargs)
        self._queue.put(task)
        return task


_QUEUE = ImageGenQueueService()


def get_image_gen_queue():
    return _QUEUE
