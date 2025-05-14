const dgram = require('dgram');
const { createClient } = require('redis');
const WebSocket = require('ws');
const crypto = require('crypto');

const hrtime = () => process.hrtime.bigint();
const fs = require('fs');
const path = require('path');

//file for benchmarking
const TIMINGS_FILE = path.join(__dirname, 'insert_times.log');

//shared key with http
const SHARED_SECRET = 'hello';
//port
const PORT = 41234;

// Insert only 1 out of every N messages
const INSERT_EVERY_NTH_MESSAGE = 1; 
let messageCount = 0;

//create the token, used to connect with http sever via websocket
function createAuthToken() {
  const timestamp = Date.now().toString(); 
  const hash = crypto.createHmac('sha256', SHARED_SECRET).update(timestamp).digest('hex');
  return { token: hash, timestamp };
}

const server = dgram.createSocket('udp4');
const { token, timestamp } = createAuthToken();

const ws = new WebSocket(`ws://localhost:3000/?token=${token}&ts=${timestamp}`);

//websocket connection
ws.on('open', () => {
  console.log('Connected to WebSocket server');
});

ws.on('close', () => {
  console.log('Websocket disconnected');
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

// Set up reddit client
const rclient = createClient({
      socket: { host: 'localhost', port: 6379 },
    });

//connect to reddis
rclient.on('error', err => console.error('Redis Client Error', err));
(async () => {
    await rclient.connect();
    console.log('Connected to Redis');
})();


// When a message is received
server.on('message', async (msg, rinfo) => {
    messageCount++;
    if (messageCount % INSERT_EVERY_NTH_MESSAGE === 0) {
        try {
            const data = JSON.parse(msg.toString());

            //Send data if websocket is connected
            if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            console.log('data sent to http server');

            } else {
            console.warn('WebSocket not ready, cannot send data');
            }

            //start time for benchmarking 
            const t0 = hrtime();

            const record = {
            log_timestamp_millis: parseInt(data.log_timestamp_millis, 10),
            seq: parseInt(data.seq, 10),
            det_drowsiness: data.det_drowsiness === 'TRUE',
            det_microsleep: data.det_microsleep === 'TRUE',
            det_reserved_0: data.det_reserved_0 === 'TRUE',
            det_no_driver: data.det_no_driver === 'TRUE',
            det_fake_driver: data.det_fake_driver === 'TRUE',
            det_eyes_on_road: data.det_eyes_on_road === 'TRUE',
            det_distraction: data.det_distraction === 'TRUE',
            det_smoking: data.det_smoking === 'TRUE',
            det_eating: data.det_eating === 'TRUE',
            det_drinking: data.det_drinking === 'TRUE',
            det_phoning: data.det_phoning === 'TRUE',
            det_reserved_1: data.det_reserved_1 === 'TRUE',
            det_long_distraction: data.det_long_distraction === 'TRUE',
            det_short_distraction: data.det_short_distraction === 'TRUE',
            timestamp: parseInt(data.timestamp, 10),
            tracking_status: parseInt(data.tracking_status, 10),
            head_pose_origin_x: parseFloat(data.head_pose_origin_x),
            head_pose_origin_y: parseFloat(data.head_pose_origin_y),
            head_pose_origin_z: parseFloat(data.head_pose_origin_z),
            head_pose_x_axis_x: parseFloat(data.head_pose_x_axis_x),
            head_pose_x_axis_y: parseFloat(data.head_pose_x_axis_y),
            head_pose_x_axis_z: parseFloat(data.head_pose_x_axis_z),
            head_pose_y_axis_x: parseFloat(data.head_pose_y_axis_x),
            head_pose_y_axis_y: parseFloat(data.head_pose_y_axis_y),
            head_pose_y_axis_z: parseFloat(data.head_pose_y_axis_z),
            head_pose_z_axis_x: parseFloat(data.head_pose_z_axis_x),
            head_pose_z_axis_y: parseFloat(data.head_pose_z_axis_y),
            head_pose_z_axis_z: parseFloat(data.head_pose_z_axis_z),
            head_pose_quality: parseFloat(data.head_pose_quality),
            consensus_gaze_origin_x: parseFloat(data.consensus_gaze_origin_x),
            consensus_gaze_origin_y: parseFloat(data.consensus_gaze_origin_y),
            consensus_gaze_origin_z: parseFloat(data.consensus_gaze_origin_z),
            consensus_gaze_direction_x: parseFloat(data.consensus_gaze_direction_x),
            consensus_gaze_direction_y: parseFloat(data.consensus_gaze_direction_y),
            consensus_gaze_direction_z: parseFloat(data.consensus_gaze_direction_z),
            consensus_gaze_quality: parseFloat(data.consensus_gaze_quality),
            se_perclos_value: parseInt(data.se_perclos_value, 10),
            se_perclos_quality: parseFloat(data.se_perclos_quality),
            drowsiness_4_level_value: parseFloat(data.drowsiness_4_level_value),
            drowsiness_4_level_status: parseInt(data.drowsiness_4_level_status, 10),
            eye_open_left_value: data.eye_open_left_value === 'TRUE',
            eye_open_left_quality: parseFloat(data.eye_open_left_quality),
            eye_open_right_value: data.eye_open_right_value === 'TRUE',
            eye_open_right_quality: parseFloat(data.eye_open_right_quality),
            eye_opening_left_value: parseFloat(data.eye_opening_left_value),
            eye_opening_left_quality: parseFloat(data.eye_opening_left_quality),
            eye_opening_right_value: parseFloat(data.eye_opening_right_value),
            eye_opening_right_quality: parseFloat(data.eye_opening_right_quality),
            eye_closure_duration: parseInt(data.eye_closure_duration, 10),
            tracking_state: parseInt(data.tracking_state, 10),
            valid: data.valid === 'TRUE',
            received_at: Date.now()
            };

            // Get a new unique ID
            const id = await rclient.incr('smarteye:next-id');
            const key = `smarteye:${id}`;

            // Store the entire record as one JSON blob
            const blob = JSON.stringify(record);
            await rclient.set(key, blob);

            // Index by time (sorted set)
            await rclient.zAdd('smarteye:by_time', {
            score: record.received_at,
            value: id.toString()
            });

            console.log('Pushed message to Redis list');
            //end time for benchmarking
            const t1 = hrtime();
            //write to log file
            fs.appendFileSync(TIMINGS_FILE, (t1 - t0).toString() + '\n')

        } catch (err) {
            console.error(`Invalid JSON or DB insert error:`, err.message);
        }
    }
});

// Bind the server to a port
server.bind(PORT, () => {
  console.log(`UDP server listening on port ${PORT}`);
})