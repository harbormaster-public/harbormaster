FROM node:0.10.45
MAINTAINER Skyler Brungardt <skyler@trueandco.com>

ADD . /tmp

WORKDIR /tmp

RUN curl https://install.meteor.com/ | sh \
 && meteor build /opt/harbormaster --directory \
 && cd /opt/harbormaster/bundle/programs/server \
 && npm install \
 && rm -rf /tmp/*

EXPOSE 80

VOLUME /root/.ssh

ENTRYPOINT ["node opt/harbormaster/bundle/main.js"]

