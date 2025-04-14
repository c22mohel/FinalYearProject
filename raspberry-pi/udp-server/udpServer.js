const dgram = require('dgram');
const { Client } = require('pg');
const WebSocket = require('ws');
const crypto = require('crypto');

//shared key with http
const SHARED_SECRET = 'hello';
//port
const PORT = 41234;

//create the token
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

// Set up PostgreSQL client
const db = new Client({
  user: 'postgres',          
  host: 'localhost',
  database: 'mydatabase',       
  password: '123',  
  port: 5432,
});

//connect to PostgreSQL
db.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('DB connection error', err.stack));


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

    // Insert JSON data into the database
    await db.query(
      `INSERT INTO smarteye_expanded (
        log_timestamp_millis, seq, det_drowsiness, det_microsleep, det_reserved_0,
        det_no_driver, det_fake_driver, det_eyes_on_road, det_distraction,
        det_smoking, det_eating, det_drinking, det_phoning, det_reserved_1,
        det_long_distraction, det_short_distraction, timestamp, tracking_status,
        head_pose_origin_x, head_pose_origin_y, head_pose_origin_z,
        head_pose_x_axis_x, head_pose_x_axis_y, head_pose_x_axis_z,
        head_pose_y_axis_x, head_pose_y_axis_y, head_pose_y_axis_z,
        head_pose_z_axis_x, head_pose_z_axis_y, head_pose_z_axis_z,
        head_pose_quality, consensus_gaze_origin_x, consensus_gaze_origin_y,
        consensus_gaze_origin_z, consensus_gaze_direction_x,
        consensus_gaze_direction_y, consensus_gaze_direction_z,
        consensus_gaze_quality, se_perclos_value, se_perclos_quality,
        drowsiness_4_level_value, drowsiness_4_level_status,
        eye_open_left_value, eye_open_left_quality, eye_open_right_value,
        eye_open_right_quality, eye_opening_left_value, eye_opening_left_quality,
        eye_opening_right_value, eye_opening_right_quality,
        eye_closure_duration, tracking_state, valid
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30,
        $31, $32, $33,
        $34, $35,
        $36, $37,
        $38, $39, $40,
        $41, $42,
        $43, $44, $45,
        $46, $47, $48,
        $49, $50,
        $51, $52, $53
      )`,
      [
        logMillis,
        seq,
        data.det_drowsiness === 'TRUE',
        data.det_microsleep === 'TRUE',
        data.det_reserved_0 === 'TRUE',
        data.det_no_driver === 'TRUE',
        data.det_fake_driver === 'TRUE',
        data.det_eyes_on_road === 'TRUE',
        data.det_distraction === 'TRUE',
        data.det_smoking === 'TRUE',
        data.det_eating === 'TRUE',
        data.det_drinking === 'TRUE',
        data.det_phoning === 'TRUE',
        data.det_reserved_1 === 'TRUE',
        data.det_long_distraction === 'TRUE',
        data.det_short_distraction === 'TRUE',
        rawTimestamp,
        parseInt(data.tracking_status),
        parseFloat(data.head_pose_origin_x),
        parseFloat(data.head_pose_origin_y),
        parseFloat(data.head_pose_origin_z),
        parseFloat(data.head_pose_x_axis_x),
        parseFloat(data.head_pose_x_axis_y),
        parseFloat(data.head_pose_x_axis_z),
        parseFloat(data.head_pose_y_axis_x),
        parseFloat(data.head_pose_y_axis_y),
        parseFloat(data.head_pose_y_axis_z),
        parseFloat(data.head_pose_z_axis_x),
        parseFloat(data.head_pose_z_axis_y),
        parseFloat(data.head_pose_z_axis_z),
        parseFloat(data.head_pose_quality),
        parseFloat(data.consensus_gaze_origin_x),
        parseFloat(data.consensus_gaze_origin_y),
        parseFloat(data.consensus_gaze_origin_z),
        parseFloat(data.consensus_gaze_direction_x),
        parseFloat(data.consensus_gaze_direction_y),
        parseFloat(data.consensus_gaze_direction_z),
        parseFloat(data.consensus_gaze_quality),
        parseInt(data.se_perclos_value),
        parseFloat(data.se_perclos_quality),
        parseFloat(data.drowsiness_4_level_value),
        parseInt(data.drowsiness_4_level_status),
        data.eye_open_left_value === 'TRUE',
        parseFloat(data.eye_open_left_quality),
        data.eye_open_right_value === 'TRUE',
        parseFloat(data.eye_open_right_quality),
        parseFloat(data.eye_opening_left_value),
        parseFloat(data.eye_opening_left_quality),
        parseFloat(data.eye_opening_right_value),
        parseFloat(data.eye_opening_right_quality),
        parseInt(data.eye_closure_duration),
        parseInt(data.tracking_state),
        data.valid === 'TRUE'
      ]
    );
    console.log('Inserted row successfully');

  } catch (err) {
    console.error(`Invalid JSON or DB insert error:`, err.message);
  }
});

// Bind the server to a port
server.bind(PORT, () => {
  console.log(`UDP server listening on port ${PORT}`);
})