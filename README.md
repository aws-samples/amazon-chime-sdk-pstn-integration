# PSTN Integration with Amazon Chime SDK Meetings

Getting started with PSTN Caller integration with Amazon Chime SDK meetings using Amazon Chime Voice Connector and FreeSWITCH.

## On this Page
- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Setup](#setup)
- [Cleaning up](#cleaning-up)
- [Conclusion](#conclusion)
- [License Summary](#license-summary)


## Project Overview
The purpose of this project is to provide an example IVR application and integration steps to allow PSTN callers to participate in Chime SDK meetings.  This solution uses Amazon Chime Voice Connector and an open source PBX/softswitch called [FreeSWITCH](https://freeswitch.com/) to provide a phone menu for dialin callers to an Amazon Chime SDK meeting.

## Architecture Overview
![](images/chimesdk-pstn.svg)

### Description
This solution can be configured to use the following services: [Amazon Chime SDK](https://aws.amazon.com/chime/) - Voice Connector, [Amazon EC2](https://aws.amazon.com/ec2/), and open source softswitch software [FreeSWITCH](https://freeswitch.com/).

Using Amazon Chime SDK meetings, you have the ability to create a custom meeting application for users to start and join over web browsers or mobile, but may also need to support callers from PSTN phones dialing in to your Chime SDK meetings. Since Chime SDK supports joining via Session Initiation Protocol (SIP) we can use Amazon Chime Voice Connector to easily claim public switched telephone network (PSTN) phone numbers for users to dial in from a phone and join or start a Chime SDK meeting. You can use any SIP enabled Private Branch Exchange (PBX) with (Interactive Voice Response) IVR application features to create a simple voice menu. This menu prompts the user for which meeting to enter and joins the caller’s audio to the meeting. 

This solution will walkthrough using an open source softswitch software called FreeSWITCH to handle PSTN connectivity to the Chime SDK meeting. A voice connector will be created under the Amazon Chime service console and integrated with the FreeSWITCH PBX to provide public phone number connectivity. 
The diagram under architecture overview shows the solution flow beginning with a Chime SDK meeting being started. A PSTN caller then calls in to the phone number assigned in the Amazon Chime Voice Connector which then triggers the FreeSWITCH PBX to interact with the PSTN caller through a voice menu which joins them to their desired meeting. Optionally you can enable voice streaming in the Amazon Chime Voice Connector to stream audio from your meeting to Amazon Kinesis Video streams. Once the audio is streamed to Kinesis you can use other AWS services like Amazon Transcribe, Amazon Comprehend, and Amazon Sagemaker on the audio stream for added analytics as well as storing the audio in Amazon S3.



## Getting Started
Before getting started, make sure that you have the following in place:

- An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
- An Amazon Chime SDK meeting application. If you don’t have an existing meeting application you can follow the instructions on [deploying the serverless browser demo](https://github.com/aws/amazon-chime-sdk-js#deploying-the-serverless-browser-demo) on GitHub
- Permissions to create [Amazon Chime Voice Connectors](https://docs.aws.amazon.com/chime/latest/ag/voice-connectors.html) and [Amazon EC2 instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-policies-for-amazon-ec2.html)
- Basic understanding of [FreeSWITCH](https://freeswitch.org/confluence/display/FREESWITCH/FreeSWITCH+Explained) software and Linux server administration
- Basic understanding of [Amazon EC2 instances](https://aws.amazon.com/ec2/) and [Amazon Chime SDK](https://aws.amazon.com/chime/chime-sdk/)


## Setup

To build this solution we will need to use Amazon EC2 and Amazon Chime Voice Connector to connect to our Amazon Chime SDK meeting application. Download these files from github to configure the IVR application in FreeSWITCH. The high level steps are as follows:

1.	Create 2 Amazon Chime Voice Connectors for inbound and outbound calling. You can optionally use a single voice connector for inbound/outbound calls. When using 2 voice connectors, you have the ability to stream and capture audio from the outbound voice connector separately which will not capture the inbound IVR entry menu.
2.	Create an EC2 Instance for the FreeSWITCH server (you can skip step 3 if you choose to use a paid ami that has FreeSWITCH preinstalled)
3.	Install and Compile FreeSWITCH 
4.	Configure FreeSWITCH to connect to Amazon Chime Voice Connector 
5.	Configure FreeSWITCH with an IVR application that plays a menu and connects the caller to the Amazon Chime SDK meeting



### Create 2 voice connectors for inbound and outbound calling
The Amazon Chime Voice Connector will be used to connect public phone numbers to your IVR application and the Chime SDK meeting.

1.	Log in to the [Amazon Chime service console](https://console.chime.aws.amazon.com/home/)
2.	On the Left pane under **Calling**, *choose* `Phone number management` and *select* **Provision phone numbers**. *Choose* **Voice Connector** and *press* **Next**. 
3.	Use the search options to select a phone number for your IVR application and *press* **Provision**
4.	On the Left pane under **Calling**, choose voice connectors and select **create new voice connector**
5.	Enter a Name `<inbound_FreeSWITCH>` and select a region for your inbound voice connector. Change the default selection of **Encryption** to `disabled` for this test environment.
6.	Under the voice connector configuration choose the **Origination** tab and select enabled. Press **New** to add a new inbound route and enter the fqdn of your FreeSWITCH server. If you don’t have the fqdn yet, you can come back and enter this after the FreeSWITCH server is installed. Use `5080` for the port, `TCP` for the protocol, and priority and weights of `1`.
7.	Assign the phone number you claimed earlier to this inbound voice connector by choosing the **Phone Numbers** tab and selecting **Assign from inventory**.  *Choose* your phone number and *press* **Assign from inventory**.
8.	Repeat steps 2-3 to add another voice connector for outbound
9.	*Enter* a Name `<outbound_FreeSWITCH>` and select a region for your outbound voice connector. Leave the default selection of `encryption enabled`.
10.	Under the voice connector configuration *choose* the **Termination** tab and select `enabled`. Enter the `IP address` of your FreeSWITCH server in the **Allowed hosts list**. If you don’t have the IP Address yet, you can come back and enter this after the FreeSWITCH server is installed.
11.	After the voice connectors are created, *copy* the **Outbound host name** of both voice connectors in the Chime Service Console. These values will be used later when configuring the FreeSWITCH server

### Create an EC2 instance for the FreeSWITCH server
The EC2 instance AMI we will use for this example is a Debian 10 Buster AMI in a t3a.medium size. You can skip choosing the Debian 10 Buster AMI and the **Install and Compile FreeSWITCH** step if you choose to use an AMI with FreeSWITCH preinstalled.

1.	Log in to the the [Amazon EC2 service console](https://console.aws.amazon.com/ec2/v2/home)
2.	*Choose* **Instances** on the left pane and *select* **Launch Instance**
3.	Search for **Debian** in the AWS Marketplace to locate the **Debian 10 Buster** AMI and *press* **select** and **continue**
4.	*Choose* the `t3a.medium` size and *choose* **Next**
5.	Select the correct network and subnet that will allow the instance to reach the Internet
6.	Configure **inbound rules** for the Security Group to allow SSH, RTP media, and SIP Signaling to host from the Amazon Chime Voice Connector subnet IP Address ranges

| Port Numbers           | Protocol | IP Address ranges              | Description    |
| -------------          |:--------:| ------------------------------:| -------------- |
| 16384-32767            | udp      | 99.77.253.0/24, 3.80.16.0/23   | Media          |
| 5080, 5060, 5061, 5063 | tcp      |   3.80.16.0/23, 99.77.253.0/24 | Signaling      |
| 22                     | tcp      |    {Your Admin IP Address} /32 | Administration |


7.	*Choose* **Review and Launch** and *select* **Launch**

### Install and compile FreeSWITCH
We will install and compile FreeSWITCH on the EC2 instance to handle the inbound calls to join a meeting and transferring to the Amazon Chime SDK meeting.
1. Follow the Easy Way instructions to install and compile FreeSWITCH and dependencies for the Debian 10 Buster operating system. Instructions can be found on the [FreeSWITCH.org website](https://freeswitch.org/confluence/display/FREESWITCH/Debian+10+Buster). Before the compile step to enter command `./configure`, make the following changes to the `modules.conf` file under `/usr/src/freeswitch`:
-	Uncomment lines for `applications/mod_curl` and `Languages/mod_v8`
-	Comment out line for `applications/mod_enum`
2.	Continue with the build commands as follows:

```
./configure
make
make install
```

Take note of the FreeSWITCH configuration locations:

------------------------------------------------------------------------------
-------------------------- FreeSWITCH configuration --------------------------

  Locations:
  
      prefix:          /usr/local/FreeSWITCH
      confdir:         /usr/local/FreeSWITCH/conf
      certsdir:        /usr/local/FreeSWITCH/certs
      scriptdir:       /usr/local/FreeSWITCH/scripts
      soundsdir:       /usr/local/FreeSWITCH/sounds
------------------------------------------------------------------------------

### Configure FreeSWITCH to connect to Amazon Chime Voice Connector 
The following steps will be used to set up TLS to the outbound voice connector created earlier and edit FreeSWITCH configuration files for integration with the voice connectors. 


1.	Generate certificates with the following commands using the name of your FreeSWITCH instance. You may need to add executable permissions to the gentls_cert (ex: `chmod +x gentls_cert`)

The `gentls_cert` utility is located in the **/usr/src/FreeSWITCH/scripts** directory. The certs will be created in **/usr/local/FreeSWITCH/certs**. 

```
./gentls_cert setup -cn <FreeSWITCH server fqdn> -alt DNS:<FreeSWITCH server fqdn> -org <your server domain>

./gentls_cert create_server -cn <FreeSWITCH server fqdn> -alt DNS: <FreeSWITCH server fqdn> -org <your server domain>
```

2.	Copy the generated certificate files from the default directory (**/usr/local/FreeSWITCH/certs**) to the **/etc/freeswitch/tls** directory. 

3.	Modify the SIP profile to enable TLS. Edit the **external.xml** file located in the **/usr/local/FreeSWITCH/conf/sip_profiles/** directory to use **/etc/FreeSWITCH/tls/**: 

```
<!-- Location of the agent.pem and cafile.pem ssl certificates (needed for TLS server) -->
    <!--<param name="tls-cert-dir" value="/etc/FreeSWITCH/tls/ "/>-->
```

4.	Modify **vars.xml** In the **/usr/local/FreeSWITCH/conf** directory with the following to change the default password, set the domain value to the fqdn of the FreeSWITCH server, and enable SRTP with the correct cipher

```
<X-PRE-PROCESS cmd="set" data="default_password=<new password here>"/>.
<X-PRE-PROCESS cmd="set" data="domain=<freeswitch_server.example.com>"/>
<X-PRE-PROCESS cmd="set" data="zrtp_secure_media=true"/>
<X-PRE-PROCESS cmd="set" data="rtp_secure_media_outbound=true:AES_CM_128_HMAC_SHA1_80"/>
```

5.	Modify **modules.conf.xml** and **switch.conf.xml** located in the **/usr/local/FreeSWITCH/conf/autoload_configs** directory to enable curl to be used for the IVR application. This application will join the PSTN caller to the Chime SDK meeting.
- **modules.conf.xml**  - uncomment 

```<!-- <load module="mod_xml_curl"/> -->```

- **switch.conf.xml** – uncomment  

```
<!-- <param name="rtp-start-port" value="16384"/> -->
<!-- <param name="rtp-end-port" value="32768"/> -->
```

6.	Note the Ports used for the internal and external SIP Profiles in the **vars.xml** file in case you need to modify these.

```
<!-- Internal SIP Profile -->
  <X-PRE-PROCESS cmd="set" data="internal_auth_calls=true"/>
  <X-PRE-PROCESS cmd="set" data="internal_sip_port=5060"/>
  <X-PRE-PROCESS cmd="set" data="internal_tls_port=5063"/>
  <X-PRE-PROCESS cmd="set" data="internal_ssl_enable=false"/>
  <!-- External SIP Profile -->
  <X-PRE-PROCESS cmd="set" data="external_auth_calls=false"/>
  <X-PRE-PROCESS cmd="set" data="external_sip_port=5080"/>
  <X-PRE-PROCESS cmd="set" data="external_tls_port=5061"/>
  <X-PRE-PROCESS cmd="set" data="external_ssl_enable=true"/>
```

7.	To create a SIP profile configuration in FreeSWITCH to connect to the outbound Voice Connector add a new file named **vc.xml** to the **/usr/local/FreeSWITCH/conf/sip_profiles/external** directory with below required fields for FreeSWITCH to connect to the outbound Amazon Chime Voice Connector. Use these required parameter values replacing values with your outbound voice connector id that was copied earlier from the Amazon Chime console. See the **example.xml** file in the same directory for more optional parameters. 

```
<include>
  <gateway name="<voice connector id>.voiceconnector.chime.aws">
  <!--/// account username *required* ///-->
  <param name="username" value="not-used"/>
  <!--/// account password *required* ///-->
  <param name="password" value="not-used"/>
  <!--/// proxy host: *optional* same as realm, if blank ///-->
  <param name="proxy" value="<voice connector id>.voiceconnector.chime.aws"/>
  <!--/// do not register ///-->
  <param name="register" value="false"/>
  <!-- which transport to use for register -->
  <param name="tls-version" value="tlsv1.2"/>
  <param name="register-transport" value="tls"/>
  <!--How many seconds before a retry when a failure or timeout occurs -->
  <!--<param name="retry-seconds" value="30"/>-->
  <!--Use the callerid of an inbound call in the from field on outbound calls via this gateway -->
  <param name="caller-id-in-from" value="true"/>
  </gateway>
</include>
```

### Configure FreeSWITCH with an IVR application that plays a menu and connects the caller to the Amazon Chime SDK meeting
1.	Create a new xml file named **chime.xml** to be used for the dialplan in the **/usr/local/FreeSWITCH/conf/dialplan/public** directory. Contents of the file is as follows. Use your voice connector id in the application bridge section. The +17035550122 phone number is a static number that is used for the [Amazon Chime Voice Connector and Amazon Chime SDK integration](https://docs.aws.amazon.com/chime/latest/dg/mtgs-sdk-cvc.html)

```
<include>
	<extension name="meeting-ivr">
		<condition field="destination_number" expression="^\+1">
	  		<!-- call the script to collect the meeting ID and resolve the join token -->
			<action application="javascript" data="JoinMeeting.js" /> 
			<!-- bridge the call to the voice connector with the join token as an INVITE parameter -->
			<action application="bridge" data="{sip_invite_params=X-chime-join-token=${join-token}}sofia/gateway/<voice connector id>.voiceconnector.chime.aws/+17035550122" />
	  </condition>
	</extension>
</include>
```
2.	Add script to play a menu for PSTN callers to join the meeting. Copy the [JoinMeeting script with audio files](https://code.amazon.com/packages/PSTNIntegrationWithChimeSDKMeetings/trees/mainline) from this repository. Add the **JoinMeeting.js** file to the **/usr/local/FreeSWITCH/scripts** directory and the **please_enter_id.wav** and the **now_join.wav** files to the **/usr/local/FreeSWITCH/sounds** directory

### Join your Chime SDK meeting from a PSTN phone
1.	Start a Chime SDK meeting with an 8 digit numeric meeting ID (e.g. 12345678). You can modify the **JoinMeeting.js** file to change your meeting ID format if you have different meeting ID criteria.
2.	Call in to the phone number you assigned to your Amazon Chime Voice Connector and when prompted, enter your meeting ID (12345678)
3.	Your call should now be connected as a participant in the Chime SDK meeting.  The following is an example screenshot. 
![](images/chimesdk-meeting.png)
 
4.	You can optionally [enable streaming](https://docs.aws.amazon.com/chime/latest/ag/start-kinesis-vc.html) on your outbound voice connector to capture the audio from your meeting for storage or analytics in AWS.  Once enabled, your audio is streamed to an Amazon Kinesis Video Stream where you can use other AWS services such as [Amazon Transcribe](https://aws.amazon.com/transcribe/) and [Amazon Comprehend](https://aws.amazon.com/comprehend/) in real-time or on stored audio.


## Cleaning up
To avoid incurring future charges, delete the EC2 instance and Voice Connector. Optionally, you can also remove your Amazon Chime SDK serverless application if you created one for this demo.

## Conclusion
In this solution you saw how to add the ability for PSTN callers to participate in your Chime SDK meetings. You also built an open source PBX/softswitch in AWS and learned about how to claim a public phone number in Amazon Chime Voice Connector. For more information on Amazon Chime Voice Connector streaming and transcription, visit this [sample project for Amazon Chime Voice Connector streaming on Github](https://github.com/aws-samples/amazon-chime-voiceconnector-transcription).  To learn more about Amazon Chime SDK please see this [Getting Started with Chime SDK blog post](https://blogposttbd).


## License Summary
This sample code is made available under a modified MIT license. See the LICENSE file.
