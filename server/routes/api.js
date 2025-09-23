const express = require('express');
const router = express.Router();
const pm2 = require('pm2');
const fs = require('fs');
const path = require('path');
const os = require('os');

let statsHistory = [];
let bandwidthStats = { in: 0, out: 0 };
let bandwidthHistory = []; // Pour le calcul sur 5 min

function bandwidthMiddleware(req, res, next) {
    let inBytes = parseInt(req.headers['content-length']) || 0;
    bandwidthStats.in += inBytes;

    let oldWrite = res.write;
    let oldEnd = res.end;
    let outBytes = 0;

    res.write = function (chunk, ...args) {
        if (chunk) outBytes += chunk.length;
        return oldWrite.apply(res, [chunk, ...args]);
    };
    res.end = function (chunk, ...args) {
        if (chunk) outBytes += chunk.length;
        bandwidthStats.out += outBytes;
        return oldEnd.apply(res, [chunk, ...args]);
    };
    next();
}

router.get('/pm2-info', (req, res) => {
    const name = req.query.name || 'server';
    pm2.connect(err => {
        if (err) {
            return res.status(500).json({ error: 'PM2 connection error', details: err });
        }
        pm2.list((err, list) => {
            pm2.disconnect();
            if (err) {
                return res.status(500).json({ error: 'PM2 list error', details: err });
            }
            const proc = list.find(p => p.name === name);
            if (!proc) {
                return res.status(404).json({ error: `Process "${name}" not found` });
            }

            // Calcule la puissance AVANT de créer stat
            const cpuPower = proc.monit.cpu * 1; // 1W par % CPU
            const ramPower = (proc.monit.memory / 1024 / 1024 / 1024) * 0.3; // 0.3W par GB
            const totalPower = cpuPower + ramPower;

            // Ajout historique CPU/RAM
            const stat = {
                time: Date.now(),
                cpu: proc.monit.cpu,
                memory: +(proc.monit.memory / 1024 / 1024).toFixed(2),
                bandwidth: {
                    in: bandwidthStats.in,
                    out: bandwidthStats.out
                },
                power: {
                    cpu: cpuPower,
                    ram: ramPower,
                    total: totalPower
                }
            };
            statsHistory.push(stat);
            if (statsHistory.length > 100) statsHistory.shift();

            // Ajout historique bandwidth pour 5 min
            bandwidthHistory.push({
                time: Date.now(),
                in: bandwidthStats.in,
                out: bandwidthStats.out
            });
            // Garde seulement les 5 dernières minutes
            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
            bandwidthHistory = bandwidthHistory.filter(b => b.time >= fiveMinAgo);

            // Bandwidth sur 5 min
            const oldest = bandwidthHistory[0] || { in: 0, out: 0 };
            const bandwidth5min = {
                in: bandwidthStats.in - oldest.in,
                out: bandwidthStats.out - oldest.out
            };

            // Uptime système
            const systemUptimeMs = os.uptime() * 1000;

            res.json({
                name: proc.name,
                status: proc.pm2_env.status,
                pid: proc.pid,
                cpu: proc.monit.cpu,
                memory: stat.memory,
                restart: proc.pm2_env.restart_time,
                uptime: Date.now() - proc.pm2_env.pm_uptime, // <-- Correction ici
                systemUptime: systemUptimeMs,
                exec_path: proc.pm2_env.pm_exec_path,
                user: proc.pm2_env.username,
                watching: proc.pm2_env.watch,
                env: proc.pm2_env.env,
                version: proc.pm2_env.node_version,
                logs: {
                    out: proc.pm2_env.pm_out_log_path,
                    err: proc.pm2_env.pm_err_log_path
                },
                statsHistory,
                bandwidth: {
                    in: bandwidthStats.in,
                    out: bandwidthStats.out
                },
                bandwidth5min,
                power: {
                    cpu: cpuPower.toFixed(2),
                    ram: ramPower.toFixed(2),
                    total: totalPower.toFixed(2)
                }
            });
        });
    });
});

router.get('/pm2-logs', (req, res) => {
    const outPath = req.query.out;
    const errPath = req.query.err;
    const lines = parseInt(req.query.lines) || 50;

    function readLastLines(filePath, n) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const arr = data.split('\n');
            return arr.slice(-n).join('\n');
        } catch (e) {
            return `Erreur lecture log: ${e.message}`;
        }
    }

    res.json({
        out: outPath ? readLastLines(outPath, lines) : '',
        err: errPath ? readLastLines(errPath, lines) : ''
    });
});

module.exports = { router, bandwidthMiddleware };