package com.njila.njila_user_service.middleware;

import com.njila.njila_user_service.enums.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Component
@Slf4j
public class JwtMiddleware extends OncePerRequestFilter {

    @Value("${njila.jwt.secret:njila-secret-key-2026-change-in-production}")
    private String jwtSecret;

    public static final String CLAIMS_ATTR = "jwtClaims";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(Keys.hmacShaKeyFor(
                            jwtSecret.getBytes(StandardCharsets.UTF_8)))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String userId = claims.getSubject();
            String roleStr = claims.get("role", String.class);
            String sessionId = claims.get("session_id", String.class);
            String filialeStr = claims.get("filiale_id", String.class);
            String agenceStr = claims.get("agence_id", String.class);

            Role role = Role.valueOf(roleStr);

            JwtClaims jwtClaims = JwtClaims.builder()
                    .userId(UUID.fromString(userId))
                    .role(role)
                    .sessionId(sessionId)
                    .filialeId(filialeStr != null ? UUID.fromString(filialeStr) : null)
                    .agenceId(agenceStr != null ? UUID.fromString(agenceStr) : null)
                    .exp(claims.getExpiration().getTime())
                    .build();

            request.setAttribute(CLAIMS_ATTR, jwtClaims);

            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    jwtClaims,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
            SecurityContextHolder.getContext().setAuthentication(auth);

            log.debug("[JWT] Authentifié : userId={} role={}", userId, roleStr);

        } catch (ExpiredJwtException e) {
            log.warn("[JWT] Token expiré");
        } catch (Exception e) {
            log.warn("[JWT] Token invalide : {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/api/users/health")
                || path.startsWith("/api/avis/agence")
                || path.startsWith("/actuator");
    }
}
