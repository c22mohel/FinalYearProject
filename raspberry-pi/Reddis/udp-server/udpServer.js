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

// Set up redis client
const rclient = createClient({
      socket: { host: 'localhost', port: 6379 },
    });

// connect to redis
rclient.on('error', err => console.error('Redis Client Error', err));
(async () => {
    await rclient.connect();
    console.log('Connected to Redis');
})();


// When a message is received
server.on('message', async (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());

    //Send data if websocket is connected
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      console.log('data sent to http server');

    } else {
      console.warn('WebSocket not ready, cannot send data');
    }

    const logMillis = parseInt(Number(data.log_timestamp_millis));
    const seq = parseInt(Number(data.seq));
    const rawTimestamp = parseInt(Number(data.timestamp));

    //start time for benchmarking 
    const t0 = hrtime();

    const id = await rclient.incr('smarteye:next-id');
    const key = `smarteye:${id}`;

    // Insert JSON data into reddis
    await rclient.hSet(key, {
      log_timestamp_millis:      logMillis.toString(),
      seq:                       seq.toString(),
      det_drowsiness:            (data.det_drowsiness === 'TRUE'   ? '1' : '0'),
      det_microsleep:            (data.det_microsleep === 'TRUE'   ? '1' : '0'),
      det_reserved_0:            (data.det_reserved_0 === 'TRUE'   ? '1' : '0'),
      det_no_driver:             (data.det_no_driver === 'TRUE'    ? '1' : '0'),
      det_fake_driver:           (data.det_fake_driver === 'TRUE'  ? '1' : '0'),
      det_eyes_on_road:          (data.det_eyes_on_road === 'TRUE' ? '1' : '0'),
      det_distraction:           (data.det_distraction === 'TRUE'  ? '1' : '0'),
      det_smoking:               (data.det_smoking === 'TRUE'      ? '1' : '0'),
      det_eating:                (data.det_eating === 'TRUE'       ? '1' : '0'),
      det_drinking:              (data.det_drinking === 'TRUE'     ? '1' : '0'),
      det_phoning:               (data.det_phoning === 'TRUE'      ? '1' : '0'),
      det_reserved_1:            (data.det_reserved_1 === 'TRUE'   ? '1' : '0'),
      det_long_distraction:      (data.det_long_distraction === 'TRUE' ? '1' : '0'),
      det_short_distraction:     (data.det_short_distraction === 'TRUE'? '1' : '0'),
      timestamp:                 rawTimestamp.toString(),
      tracking_status:           parseInt(data.tracking_status).toString(),
      head_pose_origin_x:        parseFloat(data.head_pose_origin_x).toString(),
      head_pose_origin_y:        parseFloat(data.head_pose_origin_y).toString(),
      head_pose_origin_z:        parseFloat(data.head_pose_origin_z).toString(),
      head_pose_x_axis_x:        parseFloat(data.head_pose_x_axis_x).toString(),
      head_pose_x_axis_y:        parseFloat(data.head_pose_x_axis_y).toString(),
      head_pose_x_axis_z:        parseFloat(data.head_pose_x_axis_z).toString(),
      head_pose_y_axis_x:        parseFloat(data.head_pose_y_axis_x).toString(),
      head_pose_y_axis_y:        parseFloat(data.head_pose_y_axis_y).toString(),
      head_pose_y_axis_z:        parseFloat(data.head_pose_y_axis_z).toString(),
      head_pose_z_axis_x:        parseFloat(data.head_pose_z_axis_x).toString(),
      head_pose_z_axis_y:        parseFloat(data.head_pose_z_axis_y).toString(),
      head_pose_z_axis_z:        parseFloat(data.head_pose_z_axis_z).toString(),
      head_pose_quality:         parseFloat(data.head_pose_quality).toString(),
      consensus_gaze_origin_x:   parseFloat(data.consensus_gaze_origin_x).toString(),
      consensus_gaze_origin_y:   parseFloat(data.consensus_gaze_origin_y).toString(),
      consensus_gaze_origin_z:   parseFloat(data.consensus_gaze_origin_z).toString(),
      consensus_gaze_direction_x:parseFloat(data.consensus_gaze_direction_x).toString(),
      consensus_gaze_direction_y:parseFloat(data.consensus_gaze_direction_y).toString(),
      consensus_gaze_direction_z:parseFloat(data.consensus_gaze_direction_z).toString(),
      consensus_gaze_quality:    parseFloat(data.consensus_gaze_quality).toString(),
      se_perclos_value:          parseInt(data.se_perclos_value).toString(),
      se_perclos_quality:        parseFloat(data.se_perclos_quality).toString(),
      drowsiness_4_level_value:  parseFloat(data.drowsiness_4_level_value).toString(),
      drowsiness_4_level_status: parseInt(data.drowsiness_4_level_status).toString(),
      eye_open_left_value:       (data.eye_open_left_value === 'TRUE'  ? '1' : '0'),
      eye_open_left_quality:     parseFloat(data.eye_open_left_quality).toString(),
      eye_open_right_value:      (data.eye_open_right_value === 'TRUE' ? '1' : '0'),
      eye_open_right_quality:    parseFloat(data.eye_open_right_quality).toString(),
      eye_opening_left_value:    parseFloat(data.eye_opening_left_value).toString(),
      eye_opening_left_quality:  parseFloat(data.eye_opening_left_quality).toString(),
      eye_opening_right_value:   parseFloat(data.eye_opening_right_value).toString(),
      eye_opening_right_quality: parseFloat(data.eye_opening_right_quality).toString(),
      eye_closure_duration:      parseInt(data.eye_closure_duration).toString(),
      tracking_state:            parseInt(data.tracking_state).toString(),
      valid:                     (data.valid === 'TRUE'            ? '1' : '0'),
      received_at:               Date.now().toString()
    });

    await rclient.zAdd('smarteye:by_time', {
      score: Date.now(),
      value: id.toString()
    });

    console.log(`Stored record ${id} in Redis`);

    console.log('Pushed message to Redis list');
    
    //end time for benchmarking
    const t1 = hrtime();
    //write to log file
    fs.appendFileSync(TIMINGS_FILE, (t1 - t0).toString() + '\n')

  } catch (err) {
    console.error(`Invalid JSON or DB insert error:`, err.message);
  }
});

// Bind the server to a port
server.bind(PORT, () => {
  console.log(`UDP server listening on port ${PORT}`);
})