const logger = require('../../../logger/api.logger')
const {User} = require('../Models/user.model')
const {Token} = require('../Models/token.model')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

class AuthController {
    /**
     * login user
     * @param request
     * @param response
     * @returns {Promise<void>}
     */
    async login( request, response) {
        try {
            const user = await User.findOne({
                email: request.body.email
            })

            if(!user)
            {
                response.code(404).send({
                    status: false,
                    data: null,
                    message: 'User not found'
                })
            }

            bcrypt.compare(request.body.password, user.password)
                .then(match => {
                    if(match)
                    {
                        // Create a jwt token
                        const payload = {
                            id: user._id
                        };
                        const options = {
                            expiresIn: '364d',
                            issuer: process.env.FRONT_URL
                        }
                        const secret = process.env.JWT_SECRET
                        const token = jwt.sign(payload, secret, options)

                        response.send({
                            status: true,
                            data: {
                                name: user.name,
                                email: user.email,
                                googleEmail: user.googleEmail,
                                token: token,
                                role: user.role
                            }
                        })
                    }
                    else
                    {
                        response.code(401).send({
                            status: false,
                            data: null,
                            message: 'Please enter correct email or password'
                        })
                    }
                })

            //console.log('users:::', users);
            //response.send(user);
        } catch (err) {
            logger.error('Error::' + err);
        }
    }

    /**
     * register new user
     * @param request
     * @param response
     * @returns json response
     */
    async register( request, response) {
        try {
            const saltRounds = 10
            let data = {}
            const { email, password, name } = request.body

            let hash = await bcrypt.hash(password, saltRounds)

            // Store hash in your password DB.
            data = await User.create({
                name: name,
                email: email,
                password: hash
            })

            // generate token and save
            let token = await Token.create({
                _userId: data._id,
                token: crypto.randomBytes(16).toString('hex')
            })

            //send mail mailjet
            const mailjet = require('node-mailjet').connect(
                process.env.MJ_APIKEY_PUBLIC,
                process.env.MJ_APIKEY_PRIVATE
            )

            const mailRequest = mailjet.post('send', { version: 'v3.1' }).request({
                Messages: [
                    {
                        From: {
                            Email: process.env.MJ_SENDER_EMAIL,
                            Name: process.env.MJ_SENDER_NAME,
                        },
                        To: [
                            {
                                Email: data.email,
                                Name: data.name,
                            },
                        ],
                        Subject: 'Email Verification - Easy123',
                        TextPart: 'Greetings from Mailjet!',
                        HTMLPart: 'Hello '+ data.name + ',<br>' + 'Please verify your account by clicking the link: <a href="'+process.env.FRONT_URL+'confirmation\/'+data.email+'\/'+token.token+'">Verify Email</a><br><br>Thank You!<br>'
                    },
                ],
            })

            mailRequest
                .then(result => {
                    //console.log(result.body)
                })
                .catch(err => {
                    console.log(err.statusCode)
                })

            // Create a jwt token
            const payload = {
                id: data._id
            };
            const options = {
                expiresIn: '364d',
                issuer: process.env.FRONT_URL
            }
            const secret = process.env.JWT_SECRET
            const jwtToken = jwt.sign(payload, secret, options)

            //console.log('users:::', users);
            response.send({
                status: true,
                data: {
                    name: data.name,
                    email: data.email,
                    googleEmail: data.googleEmail,
                    token: jwtToken,
                    role: data.role
                },
                message: 'success'
            })
        } catch (err) {
            response.send({
                status: false,
                data: null,
                message: 'failed'
            })
            logger.error('Error::' + err);
        }
    }

    /**
     * email confirmation
     * @param request
     * @param response
     * @returns {Promise<void>}
     */
    async confirmation(request, response) {
        try {
            let { email, token } = request.body
            token = await Token.findOne({ token: token })

            if(!token)
            {
                response.send({
                    status: false,
                    data: [],
                    message: "Link is expired"
                })
                return
            }

            let user = await User.findOne({
                _id: token._userId,
                email: email
            })

            if(!user)
            {
                response.send({
                    status: false,
                    data: [],
                    message: "User not found"
                })
                return
            }

            if(user.isVerified)
            {
                response.send({
                    status: false,
                    data: [],
                    message: "User is already verified"
                })
                return
            }

            user.emailVerified = true
            user.save()

            token.delete()

            response.send({
                status: true,
                data: [],
                message: "Email verified"
            })
            return
        }
        catch (err)
        {
            logger.error('Error::' + err)
        }
    }
}

module.exports = new AuthController();