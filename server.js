const { spawn } = require('child_process');

// Function to start the server
function startServer() {
    console.log('Starting server...');
    const serverProcess = spawn('node', ['engine.js'], { stdio: 'inherit' });

    serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        // Restart the server after a short delay
        setTimeout(() => {
            console.log('Restarting server...');
            startServer(); // Restart the server
        }, 1000); // Adjust the delay as needed
    });
}

// Start the server initially
startServer();