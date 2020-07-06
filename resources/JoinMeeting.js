
/** 
 * JoinMeeting.js
 * 
**/

use("CURL");

let api_host = 'chime meetings api host fqdn'
let region = 'us-east-1'

let name = session.getVariable('caller_id_number')
console_log("info", name)

let token = ''

function post_callback(string, arg) {
    console_log(string)
    let join_token = JSON.parse(string)
    console_log(join_token)
    token = join_token.JoinInfo.Attendee.Attendee.JoinToken

    console_log("info", token);
    return(true);
}

 
var promptfordigits_dtmf_digits = "";
 
function promptfordigits_dtmf_callback(type, digits, arg) {
    console_log("digit: " + digits + "\n");
    promptfordigits_dtmf_digits += digits;
    /* returning true does not interrupt the digit collection*/
    return(true);
}
 
/* Speaks a menu and waits for a specified number of digits. If the user does not enter a selection */
/* then the menu is repeated up to 3 times. */
function promptfordigits(ivrsession, promptname, numdigits, timeout) {
    var repeat = 0;
 
    console_log("saymenu: menu=[" + promptname + "] numdigits=[" + numdigits + "]\n");
 
    session.flushDigits();
    promptfordigits_dtmf_digits = "";
 
    while (ivrsession.ready() && promptfordigits_dtmf_digits.length < numdigits && repeat < 3) {
        /* play phrase - if digit keyed while playing callback will catch them. 
        If less than numdigits collected we get the rest after the prompt.*/
        // ivrsession.sayPhrase(promptname, numdigits, "en", promptfordigits_dtmf_callback, "");
        ivrsession.streamFile( "misc/16000/please_enter_id.wav", promptfordigits_dtmf_callback, "");
 
        console_log("Prompt done=[" + promptname + "] Collected " + promptfordigits_dtmf_digits.length + " digits [" + promptfordigits_dtmf_digits + "]\n");
 
        /* if caller still here and has not entered any selection yet (or less than numdigits entered) - wait for the rest of the digits*/
        if (ivrsession.ready() && promptfordigits_dtmf_digits.length < numdigits ) {
            promptfordigits_dtmf_digits += ivrsession.getDigits(numdigits - promptfordigits_dtmf_digits.length, "", timeout);
            /* if still no selection or insufficient digits repeat menu */
            if (promptfordigits_dtmf_digits.length < numdigits) {
                promptfordigits_dtmf_digits = "";
                repeat++;
            }
        }
    }
    return(promptfordigits_dtmf_digits);
}
 
var meetingId = "";
 
/** Let's answer our call **/
session.answer();
 
/** Play our prompt and gather meeting ID **/
meetingId = promptfordigits(session, "GetMeetingId", 8, 10000);
 
if (session.ready()) {

    console_log(meetingId)

    var curl = new CURL();
 
    curl.run("POST", `https://${api_host}/Prod/join?title=${meetingId}&name=${name}&region=${region}`, "", post_callback, "");

    // session.execute("phrase", "saydigits," + meetingId);
    session.streamFile("misc/16000/now_join.wav");
    
    session.setVariable("join-token", token);

 }
