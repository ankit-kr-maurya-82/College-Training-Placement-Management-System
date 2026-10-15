import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createTpoAccount, loginManager } from '../src/controllers/auth.controller.js';
import { User } from '../src/models/user.model.js';

const managerId = '507f1f77bcf86cd799439011';
function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

describe('Admin/TPO login', { concurrency: false }, () => {
    it('signs in an existing manager and returns a role-bearing token without the password', async (t) => {
        const originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'manager-auth-test-secret';
        t.after(() => {
            if (originalSecret === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = originalSecret;
        });
        const password = await bcrypt.hash('safe-password', 4);
        const manager = { _id: managerId, name: 'Placement TPO', email: 'tpo@example.com', role: 'TPO', password };
        t.mock.method(User, 'findOne', () => ({ select: async () => manager }));

        const res = response();
        await loginManager({ body: { email: 'TPO@example.com', password: 'safe-password' } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.user.role, 'TPO');
        assert.equal(Object.hasOwn(res.body.user, 'password'), false);
        assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).userId, managerId);
        assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).role, 'TPO');
    });

    it('uses a generic response for invalid credentials and rejects malformed input', async (t) => {
        const originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'manager-auth-test-secret';
        t.after(() => {
            if (originalSecret === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = originalSecret;
        });
        t.mock.method(User, 'findOne', () => ({ select: async () => null }));
        let res = response();
        await loginManager({ body: { email: 'tpo@example.com', password: 'safe-password' } }, res);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.message, 'Invalid email or password');
        res = response();
        await loginManager({ body: { email: 'bad-email', password: 'safe-password' } }, res);
        assert.equal(res.statusCode, 400);
    });

    it('creates only a TPO user with a hashed password', async (t) => {
        let saved;
        t.mock.method(User, 'findOne', async () => null);
        t.mock.method(User, 'create', async (input) => {
            saved = input;
            return { _id: managerId, ...input };
        });
        const res = response();
        await createTpoAccount({ body: { name: 'New TPO', email: ' NEW@EXAMPLE.COM ', password: 'safe-password' } }, res);
        assert.equal(res.statusCode, 201);
        assert.equal(saved.role, 'TPO');
        assert.equal(saved.email, 'new@example.com');
        assert.equal(await bcrypt.compare('safe-password', saved.password), true);
        assert.equal(Object.hasOwn(res.body.user, 'password'), false);
    });
});
