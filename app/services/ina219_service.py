from lib.ina219 import INA219
from app.config import RUN_MODE


class INA219Service:
    def __init__(self, addr=0x43, i2c_bus=1):
        self.addr = addr
        self.i2c_bus = i2c_bus

    def get_ups_percent(self):
        if RUN_MODE == "debug":
            return 100
        ina = INA219(i2c_bus=self.i2c_bus, addr=self.addr)
        bus_voltage = ina.getBusVoltage_V()
        percent = (bus_voltage - 3) / 1.2 * 100
        if percent > 100:
            percent = 100
        if percent < 0:
            percent = 0
        return round(percent, 1)
