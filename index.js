const express = require('express');
const proxy = require('express-http-proxy');

const config = require('./config.json');

const HOST_TYPE =
{
    static: 1,
    proxy: 2
};

const hosts = {};

config.hosts.forEach(host =>
{
    if (host.type == 'proxy')
        host.type = HOST_TYPE.proxy;
    else
        host.type = HOST_TYPE.static;

    hosts[host.domain] = host;

    console.log(host.domain + ' listening on port ' + config.port  + '...');
});

express().use((req, res, next) =>
{
    if (!(req.hostname in hosts))
        return res.status(404).send('not found');

    const host = hosts[req.hostname];

    if (host.type == HOST_TYPE.static)
        return express.static(host.source)(req, res, next);
    else if (host.type == HOST_TYPE.proxy)
        return proxy(host.source)(req, res, next);
    else
        return res.status(500).send('server error');

}).listen(config.port);