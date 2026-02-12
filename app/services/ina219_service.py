from lib.ina219 import read_ups_percent


class INA219Service:
    def __init__(self, addr=0x43, i2c_bus=1):
        self.addr = addr
        self.i2c_bus = i2c_bus

    def get_ups_percent(self):
        return read_ups_percent(addr=self.addr, i2c_bus=self.i2c_bus)
