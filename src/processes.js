const pm2 = require('pm2');

const getMonitoredApps = () => {
  if (!process.env.MONITORED_APPS) {
    return [];
  }

  return process.env.MONITORED_APPS
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
};

const listPm2Processes = () =>
  new Promise((resolve, reject) => {
    pm2.connect((connectError) => {
      if (connectError) {
        reject(connectError);
        return;
      }

      pm2.list((listError, list) => {
        pm2.disconnect();
        if (listError) {
          reject(listError);
          return;
        }
        resolve(list);
      });
    });
});

const getProcesses = async () => {
  const monitoredApps = getMonitoredApps();

  if (monitoredApps.length === 0) {
    return [];
  }

  const monitoredAppNames = new Set(monitoredApps);
  let processes;

  try {
    processes = await listPm2Processes();
  } catch (error) {
    return [];
  }

  return processes
    .filter((pm2Process) => monitoredAppNames.has(pm2Process.name))
    .map((pm2Process) => ({
      name: pm2Process.name,
      pid: pm2Process.pid,
      status: pm2Process.pm2_env?.status === 'online' ? 'running' : pm2Process.pm2_env?.status,
      cpu: pm2Process.monit?.cpu,
      memory: pm2Process.monit?.memory,
      uptime: pm2Process.pm2_env?.pm_uptime
        ? Math.floor((Date.now() - pm2Process.pm2_env.pm_uptime) / 1000)
        : 0
    }));
};

module.exports = { getProcesses };
