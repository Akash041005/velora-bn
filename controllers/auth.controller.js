import { generateToken } from '../services/auth.service.js';
import User from '../models/User.js';

export const registerController = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      email,
      password,
      name: name || email.split('@')[0]
    });

    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gender, interestedIn, style } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        preferences: { gender, interestedIn, style },
        isOnboarded: true 
      },
      { new: true }
    );

    res.json({
      message: 'Preferences updated',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, age, location, interests } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        name: name || undefined,
        bio: bio || undefined,
        age: age || undefined,
        location: location || undefined,
        interests: interests || undefined
      },
      { new: true, runValidators: false }
    );

    res.json({
      message: 'Profile updated',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        bio: user.bio,
        age: user.age,
        location: user.location,
        interests: user.interests
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
