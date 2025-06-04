#!/usr/bin/env node

const { spawn } = require('child_process');
const { dirname } = require('path');

// Simple debug script to test Docker setup
function debugDocker() {
    const hostAidevDir = dirname(__dirname);
    const hostWorkspace = process.cwd();
    
    console.log('=== Docker Debug Information ===');
    console.log('Host aidev directory:', hostAidevDir);
    console.log('Host workspace:', hostWorkspace);
    console.log();
    
    // Test 1: Check if Docker is running
    console.log('1. Testing Docker availability...');
    const dockerTest = spawn('docker', ['--version'], { stdio: 'pipe' });
    
    dockerTest.stdout.on('data', (data) => {
        console.log('Docker version:', data.toString().trim());
    });
    
    dockerTest.stderr.on('data', (data) => {
        console.error('Docker version error:', data.toString().trim());
    });
    
    dockerTest.on('close', (code) => {
        if (code === 0) {
            console.log('✓ Docker is available\n');
            testDockerImage();
        } else {
            console.log('✗ Docker is not available or not running\n');
            process.exit(1);
        }
    });
}

function testDockerImage() {
    console.log('2. Testing Docker image availability...');
    const imageTest = spawn('docker', ['images', 'aidev:latest'], { stdio: 'pipe' });
    
    let output = '';
    imageTest.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    imageTest.on('close', (code) => {
        if (output.includes('aidev') && output.includes('latest')) {
            console.log('✓ aidev:latest image found\n');
            testSimpleContainer();
        } else {
            console.log('✗ aidev:latest image not found');
            console.log('Available images:');
            console.log(output);
            console.log('\nYou may need to build the Docker image first.\n');
            process.exit(1);
        }
    });
}

function testSimpleContainer() {
    console.log('3. Testing simple container execution...');
    const containerTest = spawn('docker', [
        'run', '--rm', 'aidev:latest', 'echo', 'Container test successful'
    ], { stdio: 'pipe' });
    
    containerTest.stdout.on('data', (data) => {
        console.log('Container output:', data.toString().trim());
    });
    
    containerTest.stderr.on('data', (data) => {
        console.error('Container error:', data.toString().trim());
    });
    
    containerTest.on('close', (code) => {
        if (code === 0) {
            console.log('✓ Simple container execution successful\n');
            testMountedContainer();
        } else {
            console.log('✗ Simple container execution failed\n');
            process.exit(1);
        }
    });
}

function testMountedContainer() {
    console.log('4. Testing container with mounts...');
    const hostAidevDir = dirname(__dirname);
    const hostWorkspace = process.cwd();
    
    const mountTest = spawn('docker', [
        'run', '--rm',
        '-v', `${hostWorkspace}:/workspace:rw`,
        '-v', `${hostAidevDir}:/aidev:ro`,
        'aidev:latest',
        'ls', '-la', '/workspace', '/aidev'
    ], { stdio: 'pipe' });
    
    mountTest.stdout.on('data', (data) => {
        console.log('Mount test output:', data.toString());
    });
    
    mountTest.stderr.on('data', (data) => {
        console.error('Mount test error:', data.toString());
    });
    
    mountTest.on('close', (code) => {
        if (code === 0) {
            console.log('✓ Container mounts working\n');
            testInteractiveContainer();
        } else {
            console.log('✗ Container mounts failed\n');
            process.exit(1);
        }
    });
}

function testInteractiveContainer() {
    console.log('5. Testing interactive container (will timeout after 10 seconds)...');
    const hostAidevDir = dirname(__dirname);
    const hostWorkspace = process.cwd();
    
    const interactiveTest = spawn('docker', [
        'run', '--rm', '-it',
        '-v', `${hostWorkspace}:/workspace:rw`,
        '-v', `${hostAidevDir}:/aidev:ro`,
        'aidev:latest',
        'sleep', '5'
    ], { stdio: 'inherit' });
    
    const timeout = setTimeout(() => {
        console.log('\nTimeout reached, killing container...');
        interactiveTest.kill('SIGTERM');
    }, 10000);
    
    interactiveTest.on('close', (code, signal) => {
        clearTimeout(timeout);
        console.log(`Interactive test completed with code ${code}, signal ${signal}`);
        console.log('\n=== Debug Complete ===');
        console.log('If all tests passed, the issue may be with the aidev command itself inside the container.');
        console.log('Try running with the updated debugging output to see where it hangs.');
    });
}

debugDocker();