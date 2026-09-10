package com.technical.task.weeklyreportbackend.security;

import com.technical.task.weeklyreportbackend.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMillis;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMillis
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
    }

    public String generateToken(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                // The account's access version at the moment of issue. See User.tokenVersion.
                .claim("tokenVersion", user.getTokenVersion())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, String expectedEmail) {
        return expectedEmail.equals(extractEmail(token)) && !isTokenExpired(token);
    }

    /**
     * The access version the token was minted with, or {@code -1} when the claim is absent.
     *
     * <p>-1 rather than 0, deliberately. A token issued before this claim existed has no
     * version, and treating that as 0 would silently accept it against a fresh account whose
     * version is also 0. Returning a value no account can ever hold means such a token is
     * rejected and its holder signs in again - the safe direction for a claim whose whole
     * purpose is revocation.
     */
    public int extractTokenVersion(String token) {
        Object claim = extractAllClaims(token).get("tokenVersion");
        return claim instanceof Number number ? number.intValue() : -1;
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(extractAllClaims(token));
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
