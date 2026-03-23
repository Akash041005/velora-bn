import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (email, name) => {
  try {
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    let user = await User.findOne({ email });
    
    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      await User.create({
        email,
        name: name || email.split('@')[0],
        password: Math.random().toString(36).slice(-8),
        otp,
        otpExpires
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Velora OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Welcome to Velora!</h2>
          <p>Your OTP code is:</p>
          <h1 style="color: #6366f1; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    return { success: true, otp };
  } catch (error) {
    console.error('Send OTP error:', error);
    return { success: false, message: error.message };
  }
};

export const verifyOTP = async (email, otp) => {
  try {
    const user = await User.findOne({ 
      email,
      otp,
      otpExpires: { $gt: new Date() }
    });

    if (!user) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return false;
  }
};

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};
