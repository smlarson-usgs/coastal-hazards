FROM tomcat:8-jre8

MAINTAINER Ivan Suftin <isuftin@usgs.gov>

ARG doi_network=false

RUN if [ "${doi_network}" = true ]; then \
		/usr/bin/wget -O /usr/lib/ssl/certs/DOIRootCA.crt http://blockpage.doi.gov/images/DOIRootCA.crt && \
		ln -sf /usr/lib/ssl/certs/DOIRootCA.crt /usr/lib/ssl/certs/`openssl x509 -hash -noout -in /usr/lib/ssl/certs/DOIRootCA.crt`.0 && \
		echo "\\n\\nca-certificate = /usr/lib/ssl/certs/DOIRootCA.crt" >> /etc/wgetrc; \
	fi

ENV CCH_PORTAL_VERSION ${cch_portal_version:-"LATEST"}

RUN wget -O /usr/local/tomcat/webapps/coastal-hazards-portal.war "https://cida.usgs.gov/maven/service/local/artifact/maven/redirect?r=cida-public-releases&g=gov.usgs.cida.coastalhazards&a=coastal-hazards-portal&v=${CCH_PORTAL_VERSION}&e=war"

RUN wget -O /usr/local/tomcat/webapps/probe.war "https://github.com/psi-probe/psi-probe/releases/download/3.0.0.M3/probe.war"

RUN mkdir -p /usr/local/tomcat/ssl

RUN keytool -genkey -noprompt -keystore /usr/local/tomcat/ssl/.keystore -validity 999 -keysize 2048 -alias cch-portal -keyalg RSA -keypass changeit -storepass changeit -dname "CN=Coastal Change Hazards Portal, OU=owi, O=owi, L=middleton, S=WI, C=US" 

RUN keytool -selfcert -alias cch-portal  -keypass changeit -dname "CN=Coastal Change Hazards Portal, OU=owi, O=owi, L=middleton, S=WI, C=US" -keystore /usr/local/tomcat/ssl/.keystore -storepass changeit -validity 999

ADD https://jdbc.postgresql.org/download/postgresql-9.3-1102.jdbc41.jar /usr/local/tomcat/lib

COPY tomcat-users.xml /usr/local/tomcat/conf/tomcat-users.xml

COPY server.xml /usr/local/tomcat/conf/server.xml

COPY setenv.sh /usr/local/tomcat/bin/setenv.sh

COPY tomcat-users.xml /usr/local/tomcat/conf/tomcat-users.xml

COPY context.xml /usr/local/tomcat/conf/context.xml

RUN chmod +x /usr/local/tomcat/bin/setenv.sh

RUN rm -rf /usr/local/tomcat/bin/ROOT

RUN rm -rf /usr/local/tomcat/bin/docs

RUN rm -rf /usr/local/tomcat/bin/examples

HEALTHCHECK --interval=15s --timeout=3s \
	CMD curl -f http://localhost:8080/manager/ || exit 1
