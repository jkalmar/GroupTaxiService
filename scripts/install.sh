#!/bin/bash

RED=`tput setaf 1`
GREEN=`tput setaf 2`
RESET=`tput sgr0`

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SYSTEMDPATH="/etc/systemd/system"

usage()
{
	echo "${GREEN}Install script for GroupTaxi site/webAPI${RESET}" 
	echo "This will create .service file for systemd so it can manage the lifespan"
	echo "of the application and restart it in case of failure"
	echo ""
	echo "${GREEN}To use this first create file named 'config' in:${RESET}"
	echo "$DIR"
	echo "and put your overwrites there for:"
	echo "SCRIPTPATH, USERNAME and SERVICEFILE"
	echo "SCRIPTPATH -> the path to application entry point"
	echo "USERNAME -> the user under which the application will start"
	echo "SERVICEFILE -> the name of .service file (with the .service also)"
	echo ""
	echo "${GREEN}Example:${RESET}"
	echo 'echo SCRIPTPATH="/home/user/grouptaxi" > config'
	echo 'echo USERNAME="user" >> config '
	echo 'echo SERVICEFILE="blog.service" >> config '
	echo ""
	echo "After that run install.sh"
}

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMPDIR="/tmp/grouptaxi"

echo "INFO: Sourcing config file"

if [ ! -f $DIR/config ]; then
    echo "ERROR: file 'config' not found please create one"
	exit 1
fi

source $DIR/config

[ -z "$SCRIPTPATH" ] && ( echo "${RED}SCRIPTPATH not set${RESET}"; usage ) && exit 1
[ -z "$USERNAME" ] && ( echo "${RED}USERNAME not set${RESET}"; usage ) && exit 1
[ -z "$SERVICEFILE" ] && ( echo "${RED}SERVICEFILE not set${RESET}"; usage ) && exit 1

# temp dir for service file
mkdir -p $TMPDIR

echo "${RED}Creating .service file in ${TMPDIR}${RESET}"

cat > $TMPDIR/$SERVICEFILE <<EOF
[Unit]
Description=grouptaxi.sk application
Documentation=http://grouptaxi.sk
After=network.target

[Service]
Environment=PORT=3005
Environment=NODE_ENV=production
Type=simple
User=$USERNAME
ExecStart=$SCRIPTPATH
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

echo "${GREEN}DONE${RESET}"

echo "${RED}Installing .service file scripts${RESET}"
echo "${RED}If run as normal user a password for root is required${RESET}"

(
	set -x
	sudo install -m 755 "$TMPDIR/$SERVICEFILE" $SYSTEMDPATH
)

echo "${GREEN}DONE${RESET}"



