import base64
import threading
import json
import socket
import struct
import sys
import traceback
import time
#added import
import json

# where the Node.js UDP server is listening:
NODE_ADDR = ("192.168.182.126", 41234)
udp_out   = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# Maximum response length
RECIEVE_BUFFER_SIZE = 1024

SENSOR_ADDR = ("127.0.0.1", 1234)


class Field:
    timestamp = "timestamp"
    detections = "detections"
    tracking_status = "tracking_status"
    head_pose_origin_x = "head_pose_origin_x"
    head_pose_origin_y = "head_pose_origin_y"
    head_pose_origin_z = "head_pose_origin_z"
    head_pose_x_axis_x = "head_pose_x_axis_x"
    head_pose_x_axis_y = "head_pose_x_axis_y"
    head_pose_x_axis_z = "head_pose_x_axis_z"
    head_pose_y_axis_x = "head_pose_y_axis_x"
    head_pose_y_axis_y = "head_pose_y_axis_y"
    head_pose_y_axis_z = "head_pose_y_axis_z"
    head_pose_z_axis_x = "head_pose_z_axis_x"
    head_pose_z_axis_y = "head_pose_z_axis_y"
    head_pose_z_axis_z = "head_pose_z_axis_z"
    head_pose_quality = "head_pose_quality"
    consensus_gaze_origin_x = "consensus_gaze_origin_x"
    consensus_gaze_origin_y = "consensus_gaze_origin_y"
    consensus_gaze_origin_z = "consensus_gaze_origin_z"
    consensus_gaze_direction_x = "consensus_gaze_direction_x"
    consensus_gaze_direction_y = "consensus_gaze_direction_y"
    consensus_gaze_direction_z = "consensus_gaze_direction_z"
    consensus_gaze_quality = "consensus_gaze_quality"
    se_perclos_value = "se_perclos_value"
    se_perclos_quality = "se_perclos_quality"
    drowsiness_4_level_value = "drowsiness_4_level_value"
    drowsiness_4_level_status = "drowsiness_4_level_status"
    eye_open_left_value = "eye_open_left_value"
    eye_open_left_quality = "eye_open_left_quality"
    eye_open_right_value = "eye_open_right_value"
    eye_open_right_quality = "eye_open_right_quality"
    eye_opening_left_value = "eye_opening_left_value"
    eye_opening_left_quality = "eye_opening_left_quality"
    eye_opening_right_value = "eye_opening_right_value"
    eye_opening_right_quality = "eye_opening_right_quality"
    eye_closure_duration = "eye_closure_duration"
    tracking_state = "tracking_state"
    valid = "valid"


class Detection:
    drowsiness = "drowsiness"
    microsleep = "microsleep"
    reserved_0 = "reserved_0"
    no_driver = "no_driver"
    fake_driver = "fake_driver"
    eyes_on_road = "eyes_on_road"
    distraction = "distraction"
    smoking = "smoking"
    eating = "eating"
    drinking = "drinking"
    phoning = "phoning"
    reserved_1 = "reserved_1"
    long_distraction = "long_distraction"
    short_distraction = "short_distraction"


def _parse_message0(data):
    FIELDS = (
        # Timestamp of eye tracking (nanoseconds).
        #
        # This is the timestamp of the outgoing frame from the tracker, stamped before input into
        # the tracker. Typically, it will be two frame times delayed (~33ms) plus other latencies.
        #
        # Note: head tracking may/will be one frame delayed from this.
        # Note: this should be the only value used when checking for frame drops.
        # Note: this value is only available when tracking.
        ("Q", "timestamp"),
        #
        # Detections (drowsiness, distraction, phoning...). See DETECTIONS.
        ("I", "detections"),
        #
        # Tracking status (tracking state is in LSB).
        ("I", "tracking_status"),
        #
        # Head pose CS + quality.
        ("f", "head_pose_origin_x"),
        ("f", "head_pose_origin_y"),
        ("f", "head_pose_origin_z"),
        ("f", "head_pose_x_axis_x"),
        ("f", "head_pose_x_axis_y"),
        ("f", "head_pose_x_axis_z"),
        ("f", "head_pose_y_axis_x"),
        ("f", "head_pose_y_axis_y"),
        ("f", "head_pose_y_axis_z"),
        ("f", "head_pose_z_axis_x"),
        ("f", "head_pose_z_axis_y"),
        ("f", "head_pose_z_axis_z"),
        ("f", "head_pose_quality"),
        #
        # Consensus gaze (midpoint between eyes) + quality.
        ("f", "consensus_gaze_origin_x"),
        ("f", "consensus_gaze_origin_y"),
        ("f", "consensus_gaze_origin_z"),
        ("f", "consensus_gaze_direction_x"),
        ("f", "consensus_gaze_direction_y"),
        ("f", "consensus_gaze_direction_z"),
        ("f", "consensus_gaze_quality"),
        #
        # SE PERCLOS value + quality. (Not recommended metric.)
        ("I", "se_perclos_value"),
        ("f", "se_perclos_quality"),
        #
        # Drowsiness in 4 levels + quality. (Recommended metric.)
        ("f", "drowsiness_4_level_value"),
        ("I", "drowsiness_4_level_status"),
        #
        # Eye open (bool) and eye opening (float) for each eye + quality.
        ("?xxx", "eye_open_left_value"),
        ("f", "eye_open_left_quality"),
        ("?xxx", "eye_open_right_value"),
        ("f", "eye_open_right_quality"),
        ("f", "eye_opening_left_value"),
        ("f", "eye_opening_left_quality"),
        ("f", "eye_opening_right_value"),
        ("f", "eye_opening_right_quality"),
        #
        # Eye closure duration (nanoseconds).
        ("Q", "eye_closure_duration"),
    )
    FIELDS_FORMAT = "<" + "".join(f for f, _ in FIELDS)
    FIELDS_KEYS = (k for _, k in FIELDS)
    FIELDS_SIZE = struct.calcsize(FIELDS_FORMAT)

    DETECTIONS = (
        "drowsiness",
        "microsleep",
        "reserved_0",
        "no_driver",
        "fake_driver",
        "eyes_on_road",
        "distraction",  # = (long_distraction || short_distraction)
        "smoking",
        "eating",
        "drinking",
        "phoning",
        "reserved_1",
        "long_distraction",
        "short_distraction",  # Short (repetitive) distraction
    )

    if len(data) < FIELDS_SIZE:  # We can allow longer messages (forwards compatible).
        raise RuntimeError("Received broken message of type 0")

    # Unpack each field and make a dict of it.
    unpacked = struct.unpack(FIELDS_FORMAT, data)
    output = {k: v for k, v in zip(FIELDS_KEYS, unpacked)}

    # Fix up detections to be more meaningful. This unpacks the bitfield to real keys.
    has_detection = lambda i: (output["detections"] & (1 << i)) != 0
    output["detections"] = {
        k: has_detection(v) for k, v in zip(DETECTIONS, range(0, 32))
    }

    # The tracking state is in the LSB of the tracking status. 0 = INIT, 1 = REFIND, 2 = TRACKING.
    # Note that in some configurations of TC, the tracker never goes back to INIT again.
    output["tracking_state"] = output["tracking_status"] & 0xFF

    # The rest of the metrics are really only valid if we're in TRACKING state, except some of the
    # detections and non-tracking related data of course. If there is no head tracking, we're lost.
    output["valid"] = output["tracking_state"] == 2

    return output


# callback is a function with arguments seq and tracking info (see the example printout below)

def run(callback, log_filename = None):



    sock = None
    file = open(log_filename, "w") if log_filename else None
    def try_to_work():
        nonlocal sock
        last_file_flush = time.time()
        server = ("smarteye.local", 4567)
        #server = SENSOR_ADDR
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", 1234))

        sock.sendto(bytes(), server)
        # print("Request to send messages sent, waiting for responses...")
        sock.settimeout(5)
        last_keepalive_send = time.time()

        while True:
            buffer, _ = sock.recvfrom(RECIEVE_BUFFER_SIZE)
            if buffer and file:
                file.write(base64.b64encode(buffer).decode("utf-8") + "\n")
                if time.time() - last_file_flush > 1:
                    file.flush()
                    last_file_flush = time.time()

            if len(buffer) < 8:
                print("Received broken package without header")
                continue

            if buffer[0:3] != b"AIS":
                print("Received invalid message (invalid header)")
                continue

            message_type = buffer[3]
            seq = struct.unpack("<I", buffer[4:8])[0]
            if message_type == 0:
                try:
                    tracking_info = _parse_message0(buffer[8:])
                    if callback:
                        callback(seq, tracking_info)
                except Exception:
                    traceback.print_exc()

            else:
                print("Ignoring message of unknown type", message_type)
                continue
            if time.time() - last_keepalive_send > 10:
                sock.sendto(bytes(), server)
                last_keepalive_send = time.time()
    while True:
        try:
            try_to_work()
        except Exception as e:
            print(__file__, e)
        
        if callback:
            callback(-1, None)
        
        try:
            sock.close()
        except:
            pass
        time.sleep(2)
        
def printout(seq, tracking_info):
    if not tracking_info:
        return

    # 1) Build a payload matching your Node.js fields
    payload = {}

    # timestamp of when we logged this row
    payload["log_timestamp_millis"] = str(int(time.time() * 1000))

    # sequence and sensor timestamp
    payload["seq"]       = str(seq)
    payload["timestamp"] = str(tracking_info["timestamp"])

    # 2) Detections → det_<name> = "TRUE"/"FALSE"
    for det_name, flag in tracking_info["detections"].items():
        payload[f"det_{det_name}"] = "TRUE" if flag else "FALSE"

    # 3) All the remaining fields, as strings
    for k, v in tracking_info.items():
        if k in ("detections", "timestamp"):
            continue
        payload[k] = str(v)

    # 4) Send it
    msg = json.dumps(payload).encode("utf-8")
    udp_out.sendto(msg, NODE_ADDR)

    # (optional) debug
    print(f"→ Sent JSON ({len(msg)} bytes) to {NODE_ADDR}")


    

if __name__ == "__main__":
    run(printout)
