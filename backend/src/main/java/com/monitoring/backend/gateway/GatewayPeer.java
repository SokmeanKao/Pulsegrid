package com.monitoring.backend.gateway;

import io.grpc.Context;
import io.grpc.Contexts;
import io.grpc.Grpc;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;

import java.net.SocketAddress;

/** Captures remote peer address for HELLO upsert. */
public final class GatewayPeer {

	private static final Context.Key<String> REMOTE = Context.key("pulsegrid-remote");

	private GatewayPeer() {}

	public static String remoteAddress() {
		String v = REMOTE.get();
		return v == null ? "" : v;
	}

	public static ServerInterceptor interceptor() {
		return new ServerInterceptor() {
			@Override
			public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
					ServerCall<ReqT, RespT> call,
					Metadata headers,
					ServerCallHandler<ReqT, RespT> next) {
				SocketAddress addr = call.getAttributes().get(Grpc.TRANSPORT_ATTR_REMOTE_ADDR);
				String remote = addr == null ? "" : addr.toString();
				Context ctx = Context.current().withValue(REMOTE, remote);
				return Contexts.interceptCall(ctx, call, headers, next);
			}
		};
	}
}
