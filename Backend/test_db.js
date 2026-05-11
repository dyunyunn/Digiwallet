const { pool } = require('./database/config'); pool.query('SELECT email FROM users LIMIT 1').then(res=>console.log(res[0])).finally(()=>process.exit(0))
