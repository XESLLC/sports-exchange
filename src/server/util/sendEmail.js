const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const REGION = "us-west-2";
const client = new SESClient({ region: REGION });

exports.sendEmail = async(emailAddress, notificationEnum, message) => {
    const params = {
        Destination: {
            ToAddresses: [
                emailAddress
            ],
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: message,
                },
            },
            Subject: {
                Charset: "UTF-8",
                Data: notificationEnum,
            },
        },
        Source: "no-reply@fantasysportsstockexchange.com", // SENDER_ADDRESS
        ReplyToAddresses: ["no-reply@fantasysportsstockexchange.com"],
    };

    const command = new SendEmailCommand(params);

    try {
        const response = await client.send(command);
    } catch (error) {
        console.log(error)
    } finally {
        // finally.
    }
};
