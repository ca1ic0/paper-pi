from lib.ina219 import read_ups_percent
from app.config import RUN_MODE


class INA219Service:
    def __init__(self, addr=0x43, i2c_bus=1):
        self.addr = addr
        self.i2c_bus = i2c_bus

    def get_ups_percent(self):
        if RUN_MODE == "debug":
            return 100
        return read_ups_percent(addr=self.addr, i2c_bus=self.i2c_bus)
