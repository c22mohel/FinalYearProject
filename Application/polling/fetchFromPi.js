const axios = require('axios');


module.exports = function startDataPolling(PI_URL, db) {
    setInterval(async () => {
      try {
        console.log('Fetching data from Raspberry Pi...');
  
        const response = await axios.get(PI_URL);
        const rows = response.data;
  
        if (!Array.isArray(rows) || rows.length === 0) {
          console.log('No data received');
          return;
        }
  
        console.log(`Received ${rows.length} rows from Pi`);
        console.log('Sample row:', JSON.stringify(rows[0], null, 2)); 

        for (const row of rows) {
            const values = [
              row.log_timestamp_millis,
              row.seq,
              row.det_drowsiness,
              row.det_microsleep,
              row.det_reserved_0,
              row.det_no_driver,
              row.det_fake_driver,
              row.det_eyes_on_road,
              row.det_distraction,
              row.det_smoking,
              row.det_eating,
              row.det_drinking,
              row.det_phoning,
              row.det_reserved_1,
              row.det_long_distraction,
              row.det_short_distraction,
              row.timestamp,
              row.tracking_status,
              row.head_pose_origin_x,
              row.head_pose_origin_y,
              row.head_pose_origin_z,
              row.head_pose_x_axis_x,
              row.head_pose_x_axis_y,
              row.head_pose_x_axis_z,
              row.head_pose_y_axis_x,
              row.head_pose_y_axis_y,
              row.head_pose_y_axis_z,
              row.head_pose_z_axis_x,
              row.head_pose_z_axis_y,
              row.head_pose_z_axis_z,
              row.head_pose_quality,
              row.consensus_gaze_origin_x,
              row.consensus_gaze_origin_y,
              row.consensus_gaze_origin_z,
              row.consensus_gaze_direction_x,
              row.consensus_gaze_direction_y,
              row.consensus_gaze_direction_z,
              row.consensus_gaze_quality,
              row.se_perclos_value,
              row.se_perclos_quality,
              row.drowsiness_4_level_value,
              row.drowsiness_4_level_status,
              row.eye_open_left_value,
              row.eye_open_left_quality,
              row.eye_open_right_value,
              row.eye_open_right_quality,
              row.eye_opening_left_value,
              row.eye_opening_left_quality,
              row.eye_opening_right_value,
              row.eye_opening_right_quality,
              row.eye_closure_duration,
              row.tracking_state,
              row.valid
            ];

            await db.query(`
                INSERT INTO smarteye_expanded (
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
                )
              `, values);
            }

            console.log('Inserted all rows into archive DB');

      } catch (err) {
        console.error('Failed to fetch or insert data:', err.message);
      }
    }, 30 * 1000); // every 30 seconds
  }