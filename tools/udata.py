
# Tries to read user data from log file for DFL2 on PC.

import json

path = "/home/USER/.var/app/com.usebottles.bottles/data/bottles/bottles/gf2/" + \
        "drive_c/users/steamuser/AppData/LocalLow/SunBorn/EXILIUM/Player.log"

def parse(s):
    v = json.loads(s)
    if v["code"] == 0 and v["msg"] == "OK":
        data = v["data"]
        return {"uid": data["uid"], "token": data["access_token"], "server": "hj"}

def main():
    target = "Request = POST url = https://gf2-zoneinfo-jp.haoplay.com/passport/xindong_login"

    with open(path) as f:
        lines = f.read().split('\n')
    start = lines.index(target)
    for line in lines[start + 1:]:
        if line.startswith("Response"): # Response = {
            part = line[line.index('{'):]
            data = parse(part)
            if data:
                print(json.dumps(data))
            else:
                print("target data not found")
            break

main()
