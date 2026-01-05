FROM strictlyskyler/meteor-environment:latest
LABEL maintainer="Skyler Forge <strictlyskyler@gmail.com>"

ADD . /opt/harbormaster

WORKDIR /opt/harbormaster

# System deps (kept minimal; previously included Puppeteer/Chrome deps for legacy E2E)
RUN apt-get update
RUN apt-get install -y \
  ca-certificates \
  libc6 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libglib2.0-0 \
  libnspr4 \
  libnss3 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  lsb-release \
  wget \
  telnet

RUN mkdir /harbormaster
RUN meteor npm install
RUN meteor --allow-superuser build /harbormaster --directory
RUN ln -s /opt/harbormaster/start.sh /start.sh

WORKDIR /harbormaster/bundle/programs/server
RUN npm install
WORKDIR /

VOLUME /root/.ssh

ENTRYPOINT ["./start.sh"]