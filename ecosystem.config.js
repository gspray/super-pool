module.exports = {
    apps: [
        {
            name: 'sprinkler',
            script: 'src/index.js',
            cwd: __dirname,

            // load .env automatically
            env_file: '.env',

            // restart policy
            watch: false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000,

            // logging
            out_file: 'logs/out.log',
            error_file: 'logs/err.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            max_size: '10M',
            retain: 7,
        },
    ],
};
