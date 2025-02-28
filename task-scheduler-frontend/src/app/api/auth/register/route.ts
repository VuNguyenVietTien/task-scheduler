import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password and name are required' },
        { status: 400 }
      );
    }

    // Create user in Firebase
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get Firebase ID token
    const token = await firebaseUser.getIdToken();

    // Register user in backend
    const response = await fetch(`${process.env.BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        firebase_uid: firebaseUser.uid,
        firebase_token: token
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register user in backend');
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful'
    });
  } catch (error) {
    throw error;
  }
}
