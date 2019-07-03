const fs = require('fs');

const express = require('express');
const proxy = require('express-http-proxy');
const serveIndex = require('serve-index');
const micromatch = require('micromatch');
const parseUrl = require('parseurl');

const HOST_TYPE =
{
    static: 1,
    proxy: 2,
    alias: 3,
    redirect: 4
};

const LOG_TYPE =
{
    sys: "sys",
    access: "access",
    error: "error"
}

const CONFIG_FILE = './config.json';
const LOG_PATH = './logs/';
const LOG_FILES_AMOUNT = 14;

let hosts = {};
let hostKeys = [];
let config = {};


// ******************** logging ********************
function pad(input, amount=2, fill='0')
{
    return (input+'').padStart(amount, fill);
}

function log(type, message)
{
    let date = new Date();
    date = date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());

    message = date + ': ' + message + '\n';

    process.stdout.write(message);

    fs.appendFile(LOG_PATH + type + '.log',message, 'utf8', (error) =>
    {
        if (error)
            console.error(error)
    });
}

const logging =
{
    sys: (message) => { log('sys', message) },
    error: (message) => { log('error', message) },
    access: (message) => { log('access', message) },
}

function logRotate()
{
    logging.sys("rotating logs..");
    for(let logType in logging)
    {
        for(let i=LOG_FILES_AMOUNT-1;i>=0;--i)
        {
            let oldFilePath = LOG_PATH + logType + (i>0 ? pad(i) : '') + '.log'
            let newFilePath = LOG_PATH + logType + pad(i+1) + '.log' ;

            //if it's the last file -> delete it
            if (i == LOG_FILES_AMOUNT)
            {
                if (fs.existsSync(newFilePath))
                    fs.unlinkSync(newFilePath)
            }

            //move
            if (fs.existsSync(oldFilePath))
                fs.renameSync(oldFilePath, newFilePath)
        }
    }
}
setTimeout(logRotate, 1000 * 60 * 60 * 24);


// ******************** helpers ********************
function loadJSONfromFile(file)
{
    try
    {
        return JSON.parse(fs.readFileSync(file));
    }
    catch(error)
    {
        console.error(error);
        return null;
    }
}

function resolveHost(host, depth=1, maxDepth=5)
{
    if (depth >= maxDepth)
        return null;

    if (host.target in hosts)
    {
        if (hosts[host.target].type == HOST_TYPE.alias)
            return resolveHost(hosts[host.target], ++depth, maxDepth);
        else
            return hosts[host.target];
    }
    return null;
}

function loadConfig(json)
{
    conf = json;

    // config
    hosts = {};
    conf.hosts.forEach(host =>
    {
        if (host.type == 'proxy')
            host.type = HOST_TYPE.proxy;
        else if (host.type == 'alias')
            host.type = HOST_TYPE.alias;
        else if (host.type == 'redirect')
            host.type = HOST_TYPE.redirect;
        else
            host.type = HOST_TYPE.static;

        hosts[host.domain] = host;
    });

    for(let hostKey in hosts)
    {
        if (hosts[hostKey].type == HOST_TYPE.alias)
        {
            let resolvedHost = resolveHost(hosts[hostKey]);
            if (resolvedHost)
            {
                logging.sys(hosts[hostKey].domain + ' alias resolved to ' + resolvedHost.domain)
                hosts[hostKey] = resolvedHost;
            }
        }
        else
            logging.sys(hosts[hostKey].domain + ' listening on port ' + conf.port  + '...');
    }

    hostKeys = Object.keys(hosts);
    logging.sys('domains: '+hostKeys);

    return conf;
}

function isFiltered(req, filter)
{
    let path = parseUrl(req).pathname;
    let shouldBeFiltered = false;
    if (filter && filter.length > 0)
        shouldBeFiltered = micromatch.isMatch(path, filter);

    return shouldBeFiltered;
}


// ******************** load config ********************

logging.sys('start.. ');

config = loadConfig(loadJSONfromFile(CONFIG_FILE));
if (config.watchConfig)
{
    fs.watchFile(CONFIG_FILE, (curr, prev) =>
    {
        logging.sys('reloading config...');
        sysLogger.info({message: 'listening on '+config.port});

        let json = loadJSONfromFile(CONFIG_FILE);
        if (!json)
            logging.error('can not reload json - parse error')
        else
            config = loadConfig(json);
    });
}

logging.sys('listening on '+config.port);


// ******************** listen ********************
express().use((req, res, next) =>
{
    if (!req.hostname)
        req.hostname = '';

    logging.access('[' + req.connection.remoteAddress + '] ' + '[' + req.method + '] ' + req.protocol + '://' + req.hostname + req.originalUrl);

    //check host
    let host = hosts[req.hostname] || null;
    if (!host)
    {
        //go through all domains
        for(let domain in hosts)
        {
            if (micromatch.isMatch(req.hostname, domain))
            {
                host = hosts[domain];
                break;
            }
        }
    }

    if (!host)
        return res.status(404).send('not found');

    if (host.type == HOST_TYPE.alias)
        return res.status(500).send('alias cannot be resolved');

    // ******************** static
    if (host.type == HOST_TYPE.static && !host.index)
    {
        if (isFiltered(req,host.filter))
            return res.status(404).send('not found');
        else
            return express.static(host.target, { dotfiles: 'deny' })(req, res, next);
    }

    // ******************** static with index
    else if (host.type == HOST_TYPE.static && host.index)
    {
        return serveIndex(host.target, {'icons': true, 'view': 'details'})(req, res, () =>
        {
            if (isFiltered(req,host.filter))
                return res.status(404).send('not found');
            else
                return express.static(host.target, { dotfiles: 'deny' })(req, res, next);
        });
    }

    // ******************** proxy
    else if (host.type == HOST_TYPE.proxy)
    {
        return proxy(host.target,
        {
            proxyReqOptDecorator: (proxyReqOpts, srcReq) =>
            {
                let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                proxyReqOpts.headers['x-forwarded-for'] = ip;
                return proxyReqOpts;
            }
        })(req, res, next);
    }

    // ******************** redirect
    else if (host.type == HOST_TYPE.redirect)
        return res.redirect(host.target);

    // ******************** error
    return res.status(500).send('server error');

}).listen(config.port);