const si = require('systeminformation');

const getMetrics = async () => {
  const [cpu, load, mem, disk, net, os] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.osInfo()
  ]);
  const time = si.time();

  return {
    server: {
      hostname: os.hostname,
      platform: os.platform,
      distro: os.distro,
      uptime: time.uptime
    },
    cpu: {
      usage: load.currentLoad,
      cores: cpu.cores,
      model: cpu.brand,
      speed: cpu.speed
    },
    memory: {
      total: mem.total,
      used: mem.total - mem.available,
      free: mem.available,
      percentage: parseFloat((((mem.total - mem.available) / mem.total) * 100).toFixed(2))
    },
    disk: disk.map((d) => ({
      mount: d.mount,
      total: d.size,
      used: d.used,
      free: d.available,
      percentage: parseFloat(d.use.toFixed(2))
    })),
    network: {
      interface: net[0].iface,
      rx_sec: net[0].rx_sec != null ? parseFloat(net[0].rx_sec.toFixed(2)) : null,
      tx_sec: net[0].tx_sec != null ? parseFloat(net[0].tx_sec.toFixed(2)) : null,
      rx_total: net[0].rx_bytes,
      tx_total: net[0].tx_bytes
    },
    timestamp: new Date().toISOString()
  };
};

module.exports = { getMetrics };